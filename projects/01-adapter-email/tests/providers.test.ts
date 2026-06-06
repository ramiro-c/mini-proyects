import { describe, expect, it } from "vitest";
import { fileEmailSender } from "../src/providers/file";
import { createEmailSender } from "../src/providers/index";
import { nullEmailSender } from "../src/providers/null";
import { smtpEmailSender } from "../src/providers/smtp";

describe("createEmailSender", () => {
	it("returns smtp adapter for 'smtp' provider", () => {
		const sender = createEmailSender("smtp");
		expect(sender).toBeDefined();
		expect(typeof sender.send).toBe("function");
	});

	it("returns file adapter for 'file' provider", () => {
		const sender = createEmailSender("file");
		expect(sender).toBeDefined();
		expect(typeof sender.send).toBe("function");
	});

	it("returns null adapter for 'null' provider", () => {
		const sender = createEmailSender("null");
		expect(sender).toBeDefined();
		expect(typeof sender.send).toBe("function");
	});

	it("throws for unknown provider", () => {
		// biome-ignore lint/suspicious/noExplicitAny: we need to pass an invalid value
		expect(() => createEmailSender("unknown" as any)).toThrow("Unknown provider");
	});
});

describe("smtpEmailSender", () => {
	it("creates sender with send method", () => {
		const config = { host: "localhost", port: 1025, user: "", pass: "" };
		const sender = smtpEmailSender(config);
		expect(sender.send).toBeDefined();
		expect(typeof sender.send).toBe("function");
	});
});

describe("fileEmailSender", () => {
	it("creates sender with send method", () => {
		const sender = fileEmailSender("/tmp/emails.log");
		expect(sender.send).toBeDefined();
		expect(typeof sender.send).toBe("function");
	});
});

describe("nullEmailSender", () => {
	it("creates sender with send method", () => {
		const sender = nullEmailSender();
		expect(sender.send).toBeDefined();
		expect(typeof sender.send).toBe("function");
	});

	it("does nothing when send is called", async () => {
		const sender = nullEmailSender();
		await expect(
			sender.send({ to: "test@example.com", subject: "Test", body: "Test body" }),
		).resolves.toBeUndefined();
	});
});
