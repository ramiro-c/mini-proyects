import type { FastifyInstance } from "fastify";

type HealthDeps = {
	getProvider: () => string;
	getCircuitBreakerState: () => string;
};

export function registerHealthRoutes(fastify: FastifyInstance, deps: HealthDeps) {
	const startTime = Date.now();

	fastify.get("/health", async () => {
		const state = deps.getCircuitBreakerState();
		return {
			status: state === "open" ? "degraded" : "ok",
			provider: deps.getProvider(),
			circuitBreaker: state,
			uptime: Math.floor((Date.now() - startTime) / 1000),
		};
	});
}
