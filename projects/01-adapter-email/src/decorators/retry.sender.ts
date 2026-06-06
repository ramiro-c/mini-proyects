import type { Email, EmailSender } from "../email.adapter";
import { TransientError } from "../errors";

export type RetryConfig = {
	maxRetries: number;
	baseDelayMs: number;
	maxDelayMs: number;
};

export function retrySender(inner: EmailSender, config: RetryConfig): EmailSender {
	if (config.maxRetries <= 0) throw new Error("maxRetries must be >= 1");
	return {
		async send(email: Email): Promise<void> {
			let lastError: unknown;
			for (let attempt = 0; attempt < config.maxRetries; attempt++) {
				try {
					await inner.send(email);
					return;
				} catch (err) {
					lastError = err;
					if (!(err instanceof TransientError)) throw err;
					if (attempt < config.maxRetries - 1) {
				const maxDelay = Math.min(config.baseDelayMs * 2 ** attempt, config.maxDelayMs);
				const delay = Math.random() * maxDelay;
				await new Promise((r) => setTimeout(r, delay));
					}
				}
			}
			throw lastError;
		},
	};
}
