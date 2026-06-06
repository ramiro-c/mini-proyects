import pino, { type Logger } from "pino";
import {
	type CircuitBreakerConfig,
	circuitBreakerSender,
} from "./decorators/circuit-breaker.sender";
import { loggingSender } from "./decorators/logging.sender";
import { type RetryConfig, retrySender } from "./decorators/retry.sender";
import type { EmailSender } from "./email.adapter";
import type { EmailProviderType } from "./providers/index";
import { createEmailSender } from "./providers/index";

export type RobustSenderConfig = {
	provider: EmailProviderType;
	retry?: Partial<RetryConfig>;
	circuitBreaker?: Partial<CircuitBreakerConfig>;
};

const defaultRetry: RetryConfig = { maxRetries: 3, baseDelayMs: 200, maxDelayMs: 5000 };
const defaultCircuitBreaker: CircuitBreakerConfig = {
	failureThreshold: 5,
	timeoutMs: 30000,
};

let logger: Logger;

function getLogger() {
	if (!logger) {
		logger = pino({
			level: process.env.LOG_LEVEL ?? "info",
			transport: process.env.LOG_FILE
				? { target: "pino/file", options: { destination: process.env.LOG_FILE } }
				: undefined,
		});
	}
	return logger;
}

export function createRobustSender(config: RobustSenderConfig): EmailSender {
	let sender: EmailSender = createEmailSender(config.provider);
	sender = retrySender(sender, { ...defaultRetry, ...config.retry });
	sender = circuitBreakerSender(sender, {
		...defaultCircuitBreaker,
		...config.circuitBreaker,
	});
	sender = loggingSender(sender, getLogger());

	return sender;
}
