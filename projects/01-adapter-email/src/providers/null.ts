import type { Email, EmailSender } from "../email.adapter"

export function nullEmailSender(): EmailSender {
  return {
    async send(_email: Email) {
      // silent discard — useful for dev / tests
    },
  }
}
