import { describe, expect, it, vi } from "vitest";
import type { EmailSender } from "../src/email.adapter";
import { createUserService } from "../src/services/user.service";

function mockSender(): EmailSender {
	return { send: vi.fn().mockResolvedValue(undefined) };
}

describe("createUserService", () => {
	it("returns service with register and resetPassword methods", () => {
		const service = createUserService(mockSender());

		expect(service.register).toBeDefined();
		expect(service.resetPassword).toBeDefined();
		expect(typeof service.register).toBe("function");
		expect(typeof service.resetPassword).toBe("function");
	});

	it("calls emailSender.send with welcome email on register", async () => {
		const sender = mockSender();
		const service = createUserService(sender);
		const user = { name: "John", email: "john@example.com" };

		await service.register(user);

		expect(sender.send).toHaveBeenCalledWith({
			to: "john@example.com",
			subject: "Welcome!",
			body: "Hi John, thanks for signing up.",
		});
	});

	it("calls emailSender.send with reset email on resetPassword", async () => {
		const sender = mockSender();
		const service = createUserService(sender);
		const user = { name: "Jane", email: "jane@example.com" };

		await service.resetPassword(user);

		expect(sender.send).toHaveBeenCalledWith({
			to: "jane@example.com",
			subject: "Password reset",
			body: "Hi Jane, click here to reset your password.",
		});
	});
});
