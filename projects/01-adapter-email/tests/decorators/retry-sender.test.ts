import { describe, expect, it, vi } from "vitest";
import type { EmailSender } from "../../src/email.adapter";
import { retrySender } from "../../src/decorators/retry.sender";
import { TransientError, PermanentError } from "../../src/errors";

describe("retrySender", () => {
  it("succeeds on first attempt if no error", async () => {
    const inner: EmailSender = { send: vi.fn().mockResolvedValue(undefined) };
    const sender = retrySender(inner, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 });
    await sender.send({ to: "a@b.com", subject: "S", body: "B" });
    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  it("retries on TransientError and eventually succeeds", async () => {
    const inner: EmailSender = {
      send: vi.fn()
        .mockRejectedValueOnce(new TransientError("timeout"))
        .mockRejectedValueOnce(new TransientError("timeout"))
        .mockResolvedValueOnce(undefined),
    };
    const sender = retrySender(inner, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 });
    await sender.send({ to: "a@b.com", subject: "S", body: "B" });
    expect(inner.send).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting retries", async () => {
    const inner: EmailSender = {
      send: vi.fn().mockRejectedValue(new TransientError("timeout")),
    };
    const sender = retrySender(inner, { maxRetries: 2, baseDelayMs: 10, maxDelayMs: 100 });
    await expect(sender.send({ to: "a@b.com", subject: "S", body: "B" })).rejects.toThrow(TransientError);
    expect(inner.send).toHaveBeenCalledTimes(2);
  });

  it("does not retry on PermanentError", async () => {
    const inner: EmailSender = {
      send: vi.fn().mockRejectedValue(new PermanentError("invalid recipient")),
    };
    const sender = retrySender(inner, { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100 });
    await expect(sender.send({ to: "a@b.com", subject: "S", body: "B" })).rejects.toThrow(PermanentError);
    expect(inner.send).toHaveBeenCalledTimes(1);
  });
});
