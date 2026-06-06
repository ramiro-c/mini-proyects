import { describe, expect, it, vi } from "vitest";
import type { EmailSender } from "../../src/email.adapter";
import { loggingSender } from "../../src/decorators/logging.sender";

describe("loggingSender", () => {
  it("delegates send to inner", async () => {
    const inner: EmailSender = { send: vi.fn().mockResolvedValue(undefined) };
    const logger = { info: vi.fn(), error: vi.fn(), child: vi.fn(() => logger) };
    const sender = loggingSender(inner, logger as any);
    await sender.send({ to: "a@b.com", subject: "S", body: "B" });
    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  it("logs info on success", async () => {
    const inner: EmailSender = { send: vi.fn().mockResolvedValue(undefined) };
    const logger = { info: vi.fn(), error: vi.fn(), child: vi.fn(() => logger) };
    const sender = loggingSender(inner, logger as any);
    await sender.send({ to: "a@b.com", subject: "S", body: "B" });
    expect(logger.info).toHaveBeenCalled();
  });

  it("logs error on failure", async () => {
    const inner: EmailSender = { send: vi.fn().mockRejectedValue(new Error("fail")) };
    const logger = { info: vi.fn(), error: vi.fn(), child: vi.fn(() => logger) };
    const sender = loggingSender(inner, logger as any);
    await expect(sender.send({ to: "a@b.com", subject: "S", body: "B" })).rejects.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });
});
