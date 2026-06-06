import Fastify from "fastify";
import type { EmailSender } from "./email.adapter";
import { type EmailProviderType } from "./providers/index";
import { createRobustSender } from "./sender.factory";
import { registerProviderRoutes } from "./routes/provider.routes";
import { registerUserRoutes } from "./routes/user.routes";
import { registerHealthRoutes } from "./routes/health.routes";
import type { CircuitBreakerSender } from "./decorators/circuit-breaker.sender";

let currentProvider = process.env.EMAIL_PROVIDER ?? "null";
let sender = createRobustSender({ provider: currentProvider as EmailProviderType });

export function createServer() {
  const fastify = Fastify();

  registerProviderRoutes(fastify, {
    getProvider: () => currentProvider,
    setSender: (s: EmailSender) => { sender = s; },
  });

  registerUserRoutes(fastify, {
    getSender: () => sender,
  });

  registerHealthRoutes(fastify, {
    getProvider: () => currentProvider,
    getCircuitBreakerState: () => {
      if ("getState" in sender && typeof (sender as any).getState === "function") {
        return (sender as CircuitBreakerSender).getState();
      }
      return "unknown";
    },
  });

  return fastify;
}
