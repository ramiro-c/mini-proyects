import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { type CircuitBreakerSender, circuitBreakerSender } from "../../src/decorators/circuit-breaker.sender";
import { retrySender } from "../../src/decorators/retry.sender";
import type { Email, EmailSender } from "../../src/email.adapter";
import { TransientError } from "../../src/errors";
import { registerHealthRoutes } from "../../src/routes/health.routes";
import { registerUserRoutes } from "../../src/routes/user.routes";

function controlledProvider() {
	let shouldFail = true;
	return {
		setFail(f: boolean) { shouldFail = f; },
		send: async (_email: Email) => {
			if (shouldFail) throw new TransientError("upstream timeout");
		},
	};
}

describe("circuit breaker integration", () => {
	it("opens after repeated failures and health reports degraded", async () => {
		const provider = controlledProvider();
		const base = retrySender(provider, { maxRetries: 1, baseDelayMs: 10 });
		const cbSender: CircuitBreakerSender = circuitBreakerSender(base, {
			failureThreshold: 2,
			timeoutMs: 5000,
		});
		const sender: EmailSender = cbSender;

		const fastify = Fastify();
		registerUserRoutes(fastify, { getSender: () => sender });
		registerHealthRoutes(fastify, {
			getProvider: () => "smtp",
			getCircuitBreakerState: () => cbSender.getState(),
		});

		const payload = { name: "Test", email: "t@test.com" };

		// 2 failures → CB opens (failureThreshold: 2)
		for (let i = 0; i < 2; i++) {
			const res = await fastify.inject({ method: "POST", url: "/users/register", payload });
			expect(res.statusCode).toBe(500);
		}

		// CB open → rechaza inmediatamente sin error Transient
		const openRes = await fastify.inject({ method: "POST", url: "/users/register", payload });
		expect(openRes.statusCode).toBe(500);
		expect(openRes.json().message).toBe("Circuit breaker is open");

		// health lo refleja
		const healthRes = await fastify.inject({ method: "GET", url: "/health" });
		expect(healthRes.json()).toMatchObject({
			status: "degraded",
			circuitBreaker: "open",
		});
	});

	it("recovers after timeout when provider starts working", async () => {
		const provider = controlledProvider();
		provider.setFail(true);

		const base = retrySender(provider, { maxRetries: 1, baseDelayMs: 10 });
		const cbSender: CircuitBreakerSender = circuitBreakerSender(base, {
			failureThreshold: 1,
			timeoutMs: 400,
		});
		const sender: EmailSender = cbSender;

		const fastify = Fastify();
		registerUserRoutes(fastify, { getSender: () => sender });
		registerHealthRoutes(fastify, {
			getProvider: () => "smtp",
			getCircuitBreakerState: () => cbSender.getState(),
		});

		const payload = { name: "Test", email: "t@test.com" };

		// 1 failure → CB open
		const failRes = await fastify.inject({ method: "POST", url: "/users/register", payload });
		expect(failRes.statusCode).toBe(500);

		// esperar timeout → half_open (400ms + margen)
		await new Promise((r) => setTimeout(r, 500));

		// provider ahora funciona
		provider.setFail(false);

		// request succeed → CB closed
		const okRes = await fastify.inject({ method: "POST", url: "/users/register", payload });
		expect(okRes.statusCode).toBe(200);
		expect(okRes.json()).toEqual({ ok: true });

		const healthRes = await fastify.inject({ method: "GET", url: "/health" });
		expect(healthRes.json()).toMatchObject({
			status: "ok",
			circuitBreaker: "closed",
		});
	});
});
