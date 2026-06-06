import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import type { Email, EmailSender } from "../email.adapter";

export function fileEmailSender(outDir: string): EmailSender {
	return {
		async send(email: Email) {
			const line = `[${new Date().toISOString()}] TO=${email.to} | SUBJ=${email.subject} | BODY=${email.body}\n`;
			await appendFile(join(outDir, "emails.log"), line);
		},
	};
}
