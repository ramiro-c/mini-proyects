import { z } from "zod";
import { EmailProvider } from "./providers/index";

const ProviderSchema = z.object({
	provider: z.enum(Object.values(EmailProvider)),
});

const UserSchema = z.object({
	name: z.string().min(1),
	email: z.email(),
});

export const ChangeProviderSchema = ProviderSchema;
export const RegisterUserSchema = UserSchema;
export const ResetPasswordSchema = UserSchema;
