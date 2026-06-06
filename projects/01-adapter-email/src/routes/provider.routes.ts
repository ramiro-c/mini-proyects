import type { FastifyInstance } from "fastify";
import type { EmailSender } from "../email.adapter";
import { ChangeProviderSchema } from "../schemas";
import type { EmailProviderType } from "../providers/index";
import { createEmailSender } from "../providers/index";

export function registerProviderRoutes(
  fastify: FastifyInstance,
  deps: { getProvider: () => string; setSender: (s: EmailSender) => void },
) {
  fastify.get("/provider", async () => {
    return { provider: deps.getProvider() };
  });

  fastify.post("/provider", async (request, reply) => {
    const result = ChangeProviderSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid provider", details: result.error.issues });
    }
    const sender = createEmailSender(result.data.provider as EmailProviderType);
    deps.setSender(sender);
    return { provider: result.data.provider };
  });
}
