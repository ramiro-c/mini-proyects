import Fastify from "fastify";
import type { CircuitBreakerSender } from "./decorators/circuit-breaker.sender";
import type { EmailSender } from "./email.adapter";
import type { EmailProviderType } from "./providers/index";
import { registerHealthRoutes } from "./routes/health.routes";
import { registerProviderRoutes } from "./routes/provider.routes";
import { registerUserRoutes } from "./routes/user.routes";
import { createRobustSender } from "./sender.factory";

const currentProvider = process.env.EMAIL_PROVIDER ?? "null";
let sender = createRobustSender({ provider: currentProvider as EmailProviderType });

export function createServer() {
	const fastify = Fastify();

	registerProviderRoutes(fastify, {
		getProvider: () => currentProvider,
		setSender: (s: EmailSender) => {
			if (
				"destroy" in sender &&
				typeof (sender as CircuitBreakerSender).destroy === "function"
			) {
				(sender as CircuitBreakerSender).destroy();
			}
			sender = s;
		},
	});

	registerUserRoutes(fastify, {
		getSender: () => sender,
	});

	registerHealthRoutes(fastify, {
		getProvider: () => currentProvider,
		getCircuitBreakerState: () => {
			if (
				"getState" in sender &&
				typeof (sender as CircuitBreakerSender).getState === "function"
			) {
				return (sender as CircuitBreakerSender).getState();
			}
			return "unknown";
		},
	});

	return fastify;
}
