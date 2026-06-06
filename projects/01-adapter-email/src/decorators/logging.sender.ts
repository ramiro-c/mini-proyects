import type { Email, EmailSender } from "../email.adapter";
import type { Logger } from "pino";

export function loggingSender(inner: EmailSender, logger: Logger): EmailSender {
  return {
    ...inner,
    async send(email: Email): Promise<void> {
      const child = logger.child({ to: email.to, subject: email.subject });
      const start = Date.now();
      child.info("sending email");
      try {
        await inner.send(email);
        child.info({ durationMs: Date.now() - start }, "email sent");
      } catch (err) {
        child.error({ durationMs: Date.now() - start, err }, "email failed");
        throw err;
      }
    },
  };
}
