import { beforeEach, describe, expect, it } from "vitest";
import { createServer } from "../src/server";

describe("Fastify server", () => {
	let app: Awaited<ReturnType<typeof createServer>>;

	beforeEach(() => {
		app = createServer();
	});

	describe("GET /provider", () => {
		it("returns current provider", async () => {
			const res = await app.inject({ method: "GET", url: "/provider" });
			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({ provider: "null" });
		});
	});

	describe("POST /provider", () => {
		it("changes provider", async () => {
			const res = await app.inject({
				method: "POST",
				url: "/provider",
				payload: { provider: "file" },
			});
			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({ provider: "file" });
		});

		it("returns 400 for invalid provider", async () => {
			const res = await app.inject({
				method: "POST",
				url: "/provider",
				payload: { provider: "invalid" },
			});
			expect(res.statusCode).toBe(400);
			expect(res.json()).toHaveProperty("error");
		});
	});

	describe("POST /users/register", () => {
		it("registers user with valid data", async () => {
			const res = await app.inject({
				method: "POST",
				url: "/users/register",
				payload: { name: "John", email: "john@example.com" },
			});
			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({ ok: true });
		});

		it("returns 400 for missing name", async () => {
			const res = await app.inject({
				method: "POST",
				url: "/users/register",
				payload: { email: "john@example.com" },
			});
			expect(res.statusCode).toBe(400);
			expect(res.json()).toHaveProperty("error");
		});

		it("returns 400 for invalid email", async () => {
			const res = await app.inject({
				method: "POST",
				url: "/users/register",
				payload: { name: "John", email: "invalid" },
			});
			expect(res.statusCode).toBe(400);
			expect(res.json()).toHaveProperty("error");
		});
	});

	describe("POST /users/reset-password", () => {
		it("resets password with valid data", async () => {
			const res = await app.inject({
				method: "POST",
				url: "/users/reset-password",
				payload: { name: "Jane", email: "jane@example.com" },
			});
			expect(res.statusCode).toBe(200);
			expect(res.json()).toEqual({ ok: true });
		});
	});
});
