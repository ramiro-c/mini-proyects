import { createEmailSender } from "./providers/index.js"
import { createUserService } from "./services/user.service.js"

const provider = process.env.EMAIL_PROVIDER ?? "null"
const emailSender = createEmailSender(provider as any)
const userService = createUserService(emailSender)

async function main() {
  console.log(`Using provider: ${provider}`)

  await userService.register({ name: "Ramiro", email: "rami@test.com" })
  console.log("  ✓ welcome email sent")

  await userService.resetPassword({ name: "Ramiro", email: "rami@test.com" })
  console.log("  ✓ password reset sent")
}

main().catch(console.error)
