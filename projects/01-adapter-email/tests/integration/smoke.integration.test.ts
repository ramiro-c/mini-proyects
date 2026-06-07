import { describe, expect, it } from "vitest";
import { createServer } from "../../src/server";

describe("smoke — full server via app.inject", () => {
	const app = createServer();

	it("GET /health returns ok with null provider", async () => {
		const res = await app.inject({ method: "GET", url: "/health" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({
			status: "ok",
			provider: "null",
			circuitBreaker: expect.any(String),
			uptime: expect.any(Number),
		});
	});

	it("POST /users/register succeeds with valid data", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/users/register",
			payload: { name: "Ramiro", email: "r@test.com" },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ ok: true });
	});

	it("POST /users/register rejects invalid email", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/users/register",
			payload: { name: "Ramiro", email: "no-es-un-email" },
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().error).toBe("Invalid user data");
	});

	it("POST /users/reset-password succeeds", async () => {
		const res = await app.inject({
			method: "POST",
			url: "/users/reset-password",
			payload: { name: "Ramiro", email: "r@test.com" },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ ok: true });
	});

	it("GET /provider returns current provider", async () => {
		const res = await app.inject({ method: "GET", url: "/provider" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ provider: "null" });
	});
});
