import Fastify from "fastify"
import { createEmailSender, EmailProvider } from "./providers/index"
import { createUserService } from "./services/user.service"
import { ChangeProviderSchema, RegisterUserSchema, ResetPasswordSchema } from "./schemas"

let currentProvider = process.env.EMAIL_PROVIDER ?? "null"
let sender = createEmailSender(currentProvider as EmailProvider)
let userService = createUserService(sender)

export function createServer() {
  const fastify = Fastify()

  fastify.get("/provider", async () => {
    return { provider: currentProvider }
  })

  fastify.post("/provider", async (request, reply) => {
    const result = ChangeProviderSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid provider", details: result.error.errors })
    }

    currentProvider = result.data.provider
    sender = createEmailSender(currentProvider)
    userService = createUserService(sender)

    return { provider: currentProvider }
  })

  fastify.post("/users/register", async (request, reply) => {
    const result = RegisterUserSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid user data", details: result.error.errors })
    }

    await userService.register(result.data)
    return { ok: true }
  })

  fastify.post("/users/reset-password", async (request, reply) => {
    const result = ResetPasswordSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid user data", details: result.error.errors })
    }

    await userService.resetPassword(result.data)
    return { ok: true }
  })

  return fastify
}