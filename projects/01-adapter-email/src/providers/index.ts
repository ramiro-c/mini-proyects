import type { EmailSender } from "../email.adapter";
import { fileEmailSender } from "../providers/file";
import { nullEmailSender } from "../providers/null";
import { smtpEmailSender } from "../providers/smtp";

export const EmailProvider = { SMTP: "smtp", FILE: "file", NULL: "null" };

export type EmailProviderType = keyof typeof EmailProvider;

export function createEmailSender(provider: EmailProviderType): EmailSender {
	switch (provider) {
		case EmailProvider.SMTP:
			return smtpEmailSender({
				host: process.env.SMTP_HOST ?? "localhost",
				port: Number(process.env.SMTP_PORT) || 1025,
				user: process.env.SMTP_USER ?? "",
				pass: process.env.SMTP_PASS ?? "",
			});
		case EmailProvider.FILE:
			return fileEmailSender(process.env.LOG_DIR ?? "/tmp");
		case EmailProvider.NULL:
			return nullEmailSender();
		default:
			throw new Error(`Unknown provider: ${provider}`);
	}
}
