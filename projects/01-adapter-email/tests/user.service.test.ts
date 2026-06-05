import { describe, it, expect, vi } from "vitest"
import { createUserService } from "../src/services/user.service"

describe("createUserService", () => {
  it("returns service with register and resetPassword methods", () => {
    const mockSender = { send: vi.fn().mockResolvedValue(undefined) }
    const service = createUserService(mockSender as any)

    expect(service.register).toBeDefined()
    expect(service.resetPassword).toBeDefined()
    expect(typeof service.register).toBe("function")
    expect(typeof service.resetPassword).toBe("function")
  })

  it("calls emailSender.send with welcome email on register", async () => {
    const mockSender = { send: vi.fn().mockResolvedValue(undefined) }
    const service = createUserService(mockSender as any)
    const user = { name: "John", email: "john@example.com" }

    await service.register(user)

    expect(mockSender.send).toHaveBeenCalledWith({
      to: "john@example.com",
      subject: "Welcome!",
      body: "Hi John, thanks for signing up.",
    })
  })

  it("calls emailSender.send with reset email on resetPassword", async () => {
    const mockSender = { send: vi.fn().mockResolvedValue(undefined) }
    const service = createUserService(mockSender as any)
    const user = { name: "Jane", email: "jane@example.com" }

    await service.resetPassword(user)

    expect(mockSender.send).toHaveBeenCalledWith({
      to: "jane@example.com",
      subject: "Password reset",
      body: "Hi Jane, click here to reset your password.",
    })
  })
})