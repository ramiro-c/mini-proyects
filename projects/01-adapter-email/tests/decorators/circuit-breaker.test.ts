import { describe, expect, it, vi } from "vitest";
import { circuitBreakerSender } from "../../src/decorators/circuit-breaker.sender";
import type { EmailSender } from "../../src/email.adapter";
import { CircuitBreakerOpenError } from "../../src/errors";

describe("circuitBreakerSender", () => {
	it("sends successfully when closed", async () => {
		const inner: EmailSender = { send: vi.fn().mockResolvedValue(undefined) };
		const sender = circuitBreakerSender(inner, { failureThreshold: 2, timeoutMs: 1000 });
		await sender.send({ to: "a@b.com", subject: "S", body: "B" });
		expect(inner.send).toHaveBeenCalledTimes(1);
	});

	it("opens after failureThreshold failures", async () => {
		const inner: EmailSender = { send: vi.fn().mockRejectedValue(new Error("fail")) };
		const sender = circuitBreakerSender(inner, { failureThreshold: 2, timeoutMs: 1000 });
		await expect(
			sender.send({ to: "a@b.com", subject: "S", body: "B" }),
		).rejects.toThrow();
		await expect(
			sender.send({ to: "a@b.com", subject: "S", body: "B" }),
		).rejects.toThrow();
		await expect(sender.send({ to: "a@b.com", subject: "S", body: "B" })).rejects.toThrow(
			CircuitBreakerOpenError,
		);
		expect(inner.send).toHaveBeenCalledTimes(2);
	});

	it("allows one request through in half-open after timeout", async () => {
		const inner: EmailSender = {
			send: vi
				.fn()
				.mockRejectedValueOnce(new Error("fail"))
				.mockRejectedValueOnce(new Error("fail"))
				.mockResolvedValueOnce(undefined),
		};
		const sender = circuitBreakerSender(inner, { failureThreshold: 2, timeoutMs: 20 });
		await expect(
			sender.send({ to: "a@b.com", subject: "S", body: "B" }),
		).rejects.toThrow();
		await expect(
			sender.send({ to: "a@b.com", subject: "S", body: "B" }),
		).rejects.toThrow();
		await expect(sender.send({ to: "a@b.com", subject: "S", body: "B" })).rejects.toThrow(
			CircuitBreakerOpenError,
		);
		await new Promise((r) => setTimeout(r, 30));
		await sender.send({ to: "a@b.com", subject: "S", body: "B" });
		expect(inner.send).toHaveBeenCalledTimes(3);
	});

	it("getState() returns current state", () => {
		const inner: EmailSender = { send: vi.fn() };
		const sender = circuitBreakerSender(inner, { failureThreshold: 2, timeoutMs: 1000 });
		expect(sender.getState()).toBe("closed");
	});
});
