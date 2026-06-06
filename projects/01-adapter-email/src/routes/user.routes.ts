import type { FastifyInstance } from "fastify";
import type { EmailSender } from "../email.adapter";
import { RegisterUserSchema, ResetPasswordSchema } from "../schemas";
import type { User } from "../services/user.service";
import { createUserService } from "../services/user.service";

export function registerUserRoutes(
	fastify: FastifyInstance,
	deps: { getSender: () => EmailSender },
) {
	fastify.post("/users/register", async (request, reply) => {
		const result = RegisterUserSchema.safeParse(request.body);
		if (!result.success) {
			return reply
				.status(400)
				.send({ error: "Invalid user data", details: result.error.issues });
		}
		const service = createUserService(deps.getSender());
		await service.register(result.data as User);
		return { ok: true };
	});

	fastify.post("/users/reset-password", async (request, reply) => {
		const result = ResetPasswordSchema.safeParse(request.body);
		if (!result.success) {
			return reply
				.status(400)
				.send({ error: "Invalid user data", details: result.error.issues });
		}
		const service = createUserService(deps.getSender());
		await service.resetPassword(result.data as User);
		return { ok: true };
	});
}
