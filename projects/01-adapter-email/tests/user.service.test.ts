import { describe, expect, it, vi } from "vitest";
import type { EmailSender } from "../src/email.adapter";
import { createUserService } from "../src/services/user.service";

describe("createUserService", () => {
	it("returns service with register and resetPassword methods", () => {
		// biome-ignore lint/suspicious/noExplicitAny: mock sender
		const mockSender: EmailSender = { send: vi.fn().mockResolvedValue(undefined) as any };
		const service = createUserService(mockSender);

		expect(service.register).toBeDefined();
		expect(service.resetPassword).toBeDefined();
		expect(typeof service.register).toBe("function");
		expect(typeof service.resetPassword).toBe("function");
	});

	it("calls emailSender.send with welcome email on register", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: mock sender
		const mockSender: EmailSender = { send: vi.fn().mockResolvedValue(undefined) as any };
		const service = createUserService(mockSender);
		const user = { name: "John", email: "john@example.com" };

		await service.register(user);

		expect(mockSender.send).toHaveBeenCalledWith({
			to: "john@example.com",
			subject: "Welcome!",
			body: "Hi John, thanks for signing up.",
		});
	});

	it("calls emailSender.send with reset email on resetPassword", async () => {
		// biome-ignore lint/suspicious/noExplicitAny: mock sender
		const mockSender: EmailSender = { send: vi.fn().mockResolvedValue(undefined) as any };
		const service = createUserService(mockSender);
		const user = { name: "Jane", email: "jane@example.com" };

		await service.resetPassword(user);

		expect(mockSender.send).toHaveBeenCalledWith({
			to: "jane@example.com",
			subject: "Password reset",
			body: "Hi Jane, click here to reset your password.",
		});
	});
});
