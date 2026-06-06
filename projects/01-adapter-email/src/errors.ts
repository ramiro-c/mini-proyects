export class EmailSendError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = "EmailSendError";
	}
}

export class TransientError extends EmailSendError {
	constructor(message: string, cause?: unknown) {
		super(message, cause);
		this.name = "TransientError";
	}
}

export class PermanentError extends EmailSendError {
	constructor(message: string, cause?: unknown) {
		super(message, cause);
		this.name = "PermanentError";
	}
}

export class CircuitBreakerOpenError extends EmailSendError {
	constructor() {
		super("Circuit breaker is open");
		this.name = "CircuitBreakerOpenError";
	}
}
