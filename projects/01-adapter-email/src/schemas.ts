import { z } from "zod"

const ProviderSchema = z.object({
  provider: z.enum(["smtp", "file", "null"]),
})

const UserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
})

export const ChangeProviderSchema = ProviderSchema
export const RegisterUserSchema = UserSchema
export const ResetPasswordSchema = UserSchema