export interface Email {
  to: string
  subject: string
  body: string
}

export interface EmailSender {
  send(email: Email): Promise<void>
}
