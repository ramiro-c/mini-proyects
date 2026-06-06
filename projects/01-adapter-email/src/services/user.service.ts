import type { EmailSender } from "../email.adapter";

export type User = { name: string; email: string };

export function createUserService(emailSender: EmailSender) {
	return {
		async register(user: User) {
			// business logic — registration, save to DB, etc.
			await emailSender.send({
				to: user.email,
				subject: "Welcome!",
				body: `Hi ${user.name}, thanks for signing up.`,
			});
		},

		async resetPassword(user: User) {
			await emailSender.send({
				to: user.email,
				subject: "Password reset",
				body: `Hi ${user.name}, click here to reset your password.`,
			});
		},
	};
}
