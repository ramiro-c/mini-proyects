import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerHealthRoutes } from "../../src/routes/health.routes";

describe("GET /health", () => {
	it("returns ok when circuit breaker is closed", async () => {
		const fastify = Fastify();
		registerHealthRoutes(fastify, {
			getProvider: () => "null",
			getCircuitBreakerState: () => "closed",
		});

		const res = await fastify.inject({ method: "GET", url: "/health" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({ status: "ok", circuitBreaker: "closed" });
	});

	it("returns degraded when circuit breaker is open", async () => {
		const fastify = Fastify();
		registerHealthRoutes(fastify, {
			getProvider: () => "smtp",
			getCircuitBreakerState: () => "open",
		});

		const res = await fastify.inject({ method: "GET", url: "/health" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({ status: "degraded", circuitBreaker: "open" });
	});
});
