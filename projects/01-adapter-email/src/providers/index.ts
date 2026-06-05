import type { EmailSender } from "../email.adapter"
import { smtpEmailSender } from "../providers/smtp"
import { fileEmailSender } from "../providers/file"
import { nullEmailSender } from "../providers/null"

export type EmailProvider = "smtp" | "file" | "null"

export function createEmailSender(provider: EmailProvider): EmailSender {
  switch (provider) {
    case "smtp":
      return smtpEmailSender({
        host: process.env.SMTP_HOST ?? "localhost",
        port: Number(process.env.SMTP_PORT) || 1025,
        user: process.env.SMTP_USER ?? "",
        pass: process.env.SMTP_PASS ?? "",
      })
    case "file":
      return fileEmailSender(process.env.LOG_DIR ?? "/tmp")
    case "null":
      return nullEmailSender()
  }
}
