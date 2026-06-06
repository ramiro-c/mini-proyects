# Adapter Email — Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add retries (exponential backoff), circuit breaker, structured logging, health endpoint, and route separation to the email adapter project.

**Architecture:** Decorator Pattern — each concern implements `EmailSender` and wraps another. Composition: `Logging(CircuitBreaker(Retry(realSender)))`. Circuit breaker powered by a generic reusable `StateMachine`.

**Tech Stack:** TypeScript 5, pino (logging), Zod (config validation), Vitest (tests). Routes use Fastify plugin injection pattern.

---

## File Structure

```
src/
  lib/
    state-machine.ts            — generic reusable state machine
  decorators/
    retry.sender.ts             — RetrySender (EmailSender wrapper)
    circuit-breaker.sender.ts   — CircuitBreakerSender (EmailSender wrapper)
    logging.sender.ts           — LoggingSender (EmailSender wrapper)
  routes/
    provider.routes.ts          — GET/POST /provider
    user.routes.ts              — POST /users/register, /users/reset-password
    health.routes.ts            — GET /health
  errors.ts                     — error hierarchy
  sender.factory.ts             — composes decorators, reads env
  server.ts                     — just registers routes (modified)
tests/
  lib/
    state-machine.test.ts
  decorators/
    retry-sender.test.ts
    circuit-breaker.test.ts
    logging-sender.test.ts
  routes/
    health.routes.test.ts
```

---

### Task 1: Generic State Machine

**Files:**
- Create: `src/lib/state-machine.ts`
- Test: `tests/lib/state-machine.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/lib/state-machine.test.ts
import { describe, expect, it } from "vitest";
import { createMachine } from "../../src/lib/state-machine";

describe("createMachine", () => {
  it("starts in initial state", () => {
    const m = createMachine({
      initial: "idle",
      states: {
        idle: { on: { start: "running" } },
        running: { on: { stop: "idle" } },
      },
    });
    expect(m.state).toBe("idle");
  });

  it("transitions on valid event", () => {
    const m = createMachine({
      initial: "idle",
      states: { idle: { on: { start: "running" } }, running: { on: { stop: "idle" } } },
    });
    m.dispatch("start");
    expect(m.state).toBe("running");
  });

  it("throws on invalid transition", () => {
    const m = createMachine({
      initial: "idle",
      states: { idle: { on: { start: "running" } }, running: { on: { stop: "idle" } } },
    });
    expect(() => m.dispatch("stop")).toThrow();
  });

  it("can() returns whether event is valid in current state", () => {
    const m = createMachine({
      initial: "idle",
      states: { idle: { on: { start: "running" } }, running: { on: { stop: "idle" } } },
    });
    expect(m.can("start")).toBe(true);
    expect(m.can("stop")).toBe(false);
  });

  it("fires onEnter hooks when entering a state", () => {
    const m = createMachine({
      initial: "idle",
      states: { idle: { on: { start: "running" } }, running: { on: { stop: "idle" } } },
    });
    let entered = "";
    m.onEnter("running", () => { entered = "running"; });
    m.dispatch("start");
    expect(entered).toBe("running");
  });

  it("reset() goes back to initial state", () => {
    const m = createMachine({
      initial: "idle",
      states: { idle: { on: { start: "running" } }, running: { on: { stop: "idle" } } },
    });
    m.dispatch("start");
    m.reset();
    expect(m.state).toBe("idle");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/state-machine.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement state machine**

```typescript
// src/lib/state-machine.ts
export type MachineConfig<S extends string, E extends string> = {
  initial: S;
  states: Record<S, { on: Partial<Record<E, S>> }>;
};

export function createMachine<S extends string, E extends string>(
  config: MachineConfig<S, E>,
) {
  let current: S = config.initial;
  const hooks = new Map<S, Array<() => void>>();

  return {
    get state(): S {
      return current;
    },

    can(event: E): boolean {
      return config.states[current].on[event] !== undefined;
    },

    dispatch(event: E): void {
      const next = config.states[current].on[event];
      if (!next) {
        throw new Error(`Invalid transition: ${current} -> ${String(event)}`);
      }
      current = next as S;
      hooks.get(current)?.forEach((fn) => fn());
    },

    onEnter(state: S, fn: () => void): void {
      if (!hooks.has(state)) hooks.set(state, []);
      hooks.get(state)!.push(fn);
    },

    reset(): void {
      current = config.initial;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/state-machine.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/state-machine.ts tests/lib/state-machine.test.ts
git commit -m "feat: add generic reusable state machine"
```

---

### Task 2: Error Types

**Files:**
- Create: `src/errors.ts`

- [ ] **Step 1: Create error hierarchy**

```typescript
// src/errors.ts
export class EmailSendError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "EmailSendError";
  }
}

export class TransientError extends EmailSendError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "TransientError";
  }
}

export class PermanentError extends EmailSendError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "PermanentError";
  }
}

export class CircuitBreakerOpenError extends EmailSendError {
  constructor() {
    super("Circuit breaker is open");
    this.name = "CircuitBreakerOpenError";
  }
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/errors.ts
git commit -m "feat: add email error hierarchy"
```

---

### Task 3: RetrySender

**Files:**
- Create: `src/decorators/retry.sender.ts`
- Test: `tests/decorators/retry-sender.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/decorators/retry-sender.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/decorators/retry-sender.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement RetrySender**

```typescript
// src/decorators/retry.sender.ts
import type { Email, EmailSender } from "../email.adapter";
import { TransientError } from "../errors";

export type RetryConfig = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export function retrySender(inner: EmailSender, config: RetryConfig): EmailSender {
  return {
    async send(email: Email): Promise<void> {
      let lastError: unknown;
      for (let attempt = 0; attempt < config.maxRetries; attempt++) {
        try {
          await inner.send(email);
          return;
        } catch (err) {
          lastError = err;
          if (!(err instanceof TransientError)) throw err;
          if (attempt < config.maxRetries - 1) {
            const exp = Math.min(config.baseDelayMs * 2 ** attempt, config.maxDelayMs);
            const jitter = Math.random() * exp;
            await new Promise((r) => setTimeout(r, jitter));
          }
        }
      }
      throw lastError;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/decorators/retry-sender.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/decorators/retry.sender.ts tests/decorators/retry-sender.test.ts
git commit -m "feat: add retry sender with exponential backoff"
```

---

### Task 4: CircuitBreakerSender

**Files:**
- Create: `src/decorators/circuit-breaker.sender.ts`
- Test: `tests/decorators/circuit-breaker.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/decorators/circuit-breaker.test.ts
import { describe, expect, it, vi } from "vitest";
import type { EmailSender } from "../../src/email.adapter";
import { circuitBreakerSender } from "../../src/decorators/circuit-breaker.sender";
import { CircuitBreakerOpenError } from "../../src/errors";

describe("circuitBreakerSender", () => {
  it("sends successfully when closed", async () => {
    const inner: EmailSender = { send: vi.fn().mockResolvedValue(undefined) };
    const sender = circuitBreakerSender(inner, { failureThreshold: 2, timeoutMs: 1000 });
    await sender.send({ to: "a@b.com", subject: "S", body: "B" });
    expect(inner.send).toHaveBeenCalledTimes(1);
  });

  it("opens after failureThreshold failures", async () => {
    const inner: EmailSender = { send: vi.fn().mockRejectedValue(new Error("fail")) };
    const sender = circuitBreakerSender(inner, { failureThreshold: 2, timeoutMs: 1000 });
    await expect(sender.send({ to: "a@b.com", subject: "S", body: "B" })).rejects.toThrow();
    await expect(sender.send({ to: "a@b.com", subject: "S", body: "B" })).rejects.toThrow();
    await expect(sender.send({ to: "a@b.com", subject: "S", body: "B" })).rejects.toThrow(CircuitBreakerOpenError);
    expect(inner.send).toHaveBeenCalledTimes(2);
  });

  it("allows one request through in half-open after timeout", async () => {
    const inner: EmailSender = {
      send: vi.fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValueOnce(undefined),
    };
    const sender = circuitBreakerSender(inner, { failureThreshold: 2, timeoutMs: 20 });
    await expect(sender.send({ to: "a@b.com", subject: "S", body: "B" })).rejects.toThrow();
    await expect(sender.send({ to: "a@b.com", subject: "S", body: "B" })).rejects.toThrow();
    await expect(sender.send({ to: "a@b.com", subject: "S", body: "B" })).rejects.toThrow(CircuitBreakerOpenError);
    await new Promise((r) => setTimeout(r, 30));
    await sender.send({ to: "a@b.com", subject: "S", body: "B" });
    expect(inner.send).toHaveBeenCalledTimes(3);
  });

  it("getState() returns current state", () => {
    const inner: EmailSender = { send: vi.fn() };
    const sender = circuitBreakerSender(inner, { failureThreshold: 2, timeoutMs: 1000 });
    expect(sender.getState()).toBe("closed");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/decorators/circuit-breaker.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement CircuitBreakerSender**

```typescript
// src/decorators/circuit-breaker.sender.ts
import type { Email, EmailSender } from "../email.adapter";
import { CircuitBreakerOpenError } from "../errors";
import { createMachine } from "../lib/state-machine";

export type CircuitBreakerConfig = {
  failureThreshold: number;
  timeoutMs: number;
};

type CbState = "closed" | "open" | "half_open";
type CbEvent = "fail" | "success" | "timeout";

export type CircuitBreakerSender = EmailSender & {
  getState(): CbState;
};

export function circuitBreakerSender(
  inner: EmailSender,
  config: CircuitBreakerConfig,
): CircuitBreakerSender {
  const machine = createMachine<CbState, CbEvent>({
    initial: "closed",
    states: {
      closed: { on: { fail: "open" } },
      open: { on: { timeout: "half_open" } },
      half_open: { on: { success: "closed", fail: "open" } },
    },
  });

  let failureCount = 0;
  let testRequestInFlight = false;

  function scheduleTimeout() {
    setTimeout(() => {
      if (machine.state === "open") {
        machine.dispatch("timeout");
        testRequestInFlight = false;
      }
    }, config.timeoutMs);
  }

  return {
    getState() {
      return machine.state;
    },

    async send(email: Email): Promise<void> {
      if (machine.state === "open") {
        throw new CircuitBreakerOpenError();
      }

      if (machine.state === "half_open" && testRequestInFlight) {
        throw new CircuitBreakerOpenError();
      }

      if (machine.state === "half_open") {
        testRequestInFlight = true;
      }

      try {
        await inner.send(email);
        if (machine.state === "half_open") {
          machine.dispatch("success");
          failureCount = 0;
          testRequestInFlight = false;
        } else {
          failureCount = 0;
        }
      } catch (err) {
        if (err instanceof CircuitBreakerOpenError) throw err;
        if (machine.state === "half_open") {
          machine.dispatch("fail");
          scheduleTimeout();
          testRequestInFlight = false;
        } else {
          failureCount++;
          if (failureCount >= config.failureThreshold) {
            machine.dispatch("fail");
            scheduleTimeout();
          }
        }
        throw err;
      }
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/decorators/circuit-breaker.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/decorators/circuit-breaker.sender.ts tests/decorators/circuit-breaker.test.ts
git commit -m "feat: add circuit breaker sender"
```

---

### Task 5: LoggingSender

**Files:**
- Create: `src/decorators/logging.sender.ts`
- Test: `tests/decorators/logging-sender.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/decorators/logging-sender.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/decorators/logging-sender.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement LoggingSender**

```typescript
// src/decorators/logging.sender.ts
import type { Email, EmailSender } from "../email.adapter";
import type { Logger } from "pino";

export function loggingSender(inner: EmailSender, logger: Logger): EmailSender {
  return {
    async send(email: Email): Promise<void> {
      const child = logger.child({ to: email.to, subject: email.subject });
      const start = Date.now();
      child.info("sending email");
      try {
        await inner.send(email);
        child.info({ durationMs: Date.now() - start }, "email sent");
      } catch (err) {
        child.error({ durationMs: Date.now() - start, err }, "email failed");
        throw err;
      }
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/decorators/logging-sender.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/decorators/logging.sender.ts tests/decorators/logging-sender.test.ts
git commit -m "feat: add logging sender"
```

---

### Task 6: Install pino

- [ ] **Step 1: Install dependency**

Run: `npm install pino`

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pino dependency"
```

---

### Task 7: Routes Refactoring

**Files:**
- Create: `src/routes/provider.routes.ts`
- Create: `src/routes/user.routes.ts`
- Create: `src/routes/health.routes.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Create provider routes**

```typescript
// src/routes/provider.routes.ts
import type { FastifyInstance } from "fastify";
import type { EmailSender } from "../email.adapter";
import { ChangeProviderSchema } from "../schemas";
import type { EmailProviderType } from "../providers/index";
import { createEmailSender } from "../providers/index";

export function registerProviderRoutes(
  fastify: FastifyInstance,
  deps: { getProvider: () => string; setSender: (s: EmailSender) => void },
) {
  fastify.get("/provider", async () => {
    return { provider: deps.getProvider() };
  });

  fastify.post("/provider", async (request, reply) => {
    const result = ChangeProviderSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid provider", details: result.error.issues });
    }
    const sender = createEmailSender(result.data.provider as EmailProviderType);
    deps.setSender(sender);
    return { provider: result.data.provider };
  });
}
```

- [ ] **Step 2: Create user routes**

```typescript
// src/routes/user.routes.ts
import type { FastifyInstance } from "fastify";
import { RegisterUserSchema, ResetPasswordSchema } from "../schemas";
import type { User } from "../services/user.service";
import { createUserService } from "../services/user.service";
import type { EmailSender } from "../email.adapter";

export function registerUserRoutes(fastify: FastifyInstance, deps: { getSender: () => EmailSender }) {
  fastify.post("/users/register", async (request, reply) => {
    const result = RegisterUserSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid user data", details: result.error.issues });
    }
    const service = createUserService(deps.getSender());
    await service.register(result.data as User);
    return { ok: true };
  });

  fastify.post("/users/reset-password", async (request, reply) => {
    const result = ResetPasswordSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: "Invalid user data", details: result.error.issues });
    }
    const service = createUserService(deps.getSender());
    await service.resetPassword(result.data as User);
    return { ok: true };
  });
}
```

- [ ] **Step 3: Create health routes**

```typescript
// src/routes/health.routes.ts
import type { FastifyInstance } from "fastify";
import type { CircuitBreakerSender } from "../decorators/circuit-breaker.sender";

type HealthDeps = {
  getProvider: () => string;
  getCircuitBreakerState: () => string;
};

export function registerHealthRoutes(fastify: FastifyInstance, deps: HealthDeps) {
  const startTime = Date.now();

  fastify.get("/health", async () => {
    const state = deps.getCircuitBreakerState();
    return {
      status: state === "open" ? "degraded" : "ok",
      provider: deps.getProvider(),
      circuitBreaker: state,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };
  });
}
```

- [ ] **Step 4: Update server.ts to use routes**

```typescript
// src/server.ts
import Fastify from "fastify";
import type { EmailSender } from "./email.adapter";
import { createEmailSender, EmailProvider, type EmailProviderType } from "./providers/index";
import { registerProviderRoutes } from "./routes/provider.routes";
import { registerUserRoutes } from "./routes/user.routes";
import { registerHealthRoutes } from "./routes/health.routes";
import type { CircuitBreakerSender } from "./decorators/circuit-breaker.sender";

let currentProvider = process.env.EMAIL_PROVIDER ?? "null";
let sender = createEmailSender(currentProvider as EmailProviderType);

export function createServer() {
  const fastify = Fastify();

  registerProviderRoutes(fastify, {
    getProvider: () => currentProvider,
    setSender: (s: EmailSender) => { sender = s; },
  });

  registerUserRoutes(fastify, {
    getSender: () => sender,
  });

  registerHealthRoutes(fastify, {
    getProvider: () => currentProvider,
    getCircuitBreakerState: () => {
      if ("getState" in sender && typeof (sender as any).getState === "function") {
        return (sender as CircuitBreakerSender).getState();
      }
      return "unknown";
    },
  });

  return fastify;
}
```

- [ ] **Step 5: Run existing tests to verify nothing broke**

Run: `npx vitest run`
Expected: existing provider + user service + fastify tests pass

- [ ] **Step 6: Commit**

```bash
git add src/routes/ src/server.ts
git commit -m "refactor: extract routes into separate files"
```

---

### Task 8: Sender Factory + Integration

**Files:**
- Create: `src/sender.factory.ts`
- Modify: `src/server.ts`
- Modify: `tests/fastify.test.ts`

- [ ] **Step 1: Implement sender factory**

```typescript
// src/sender.factory.ts
import type { EmailSender } from "./email.adapter";
import type { EmailProviderType } from "./providers/index";
import { createEmailSender } from "./providers/index";
import { retrySender, type RetryConfig } from "./decorators/retry.sender";
import { circuitBreakerSender, type CircuitBreakerConfig, type CircuitBreakerSender } from "./decorators/circuit-breaker.sender";
import { loggingSender } from "./decorators/logging.sender";
import pino from "pino";

export type RobustSenderConfig = {
  provider: EmailProviderType;
  retry?: Partial<RetryConfig>;
  circuitBreaker?: Partial<CircuitBreakerConfig>;
};

const defaultRetry: RetryConfig = { maxRetries: 3, baseDelayMs: 200, maxDelayMs: 5000 };
const defaultCircuitBreaker: CircuitBreakerConfig = { failureThreshold: 5, timeoutMs: 30000 };

export function createRobustSender(config: RobustSenderConfig): EmailSender {
  const logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    transport:
      process.env.LOG_FILE
        ? { target: "pino/file", options: { destination: process.env.LOG_FILE } }
        : undefined,
  });

  let sender: EmailSender = createEmailSender(config.provider);
  sender = retrySender(sender, { ...defaultRetry, ...config.retry });
  sender = circuitBreakerSender(sender, { ...defaultCircuitBreaker, ...config.circuitBreaker });
  sender = loggingSender(sender, logger);

  return sender;
}
```

- [ ] **Step 2: Integrate into server.ts**

Replace the current sender creation in `server.ts`:

Old:
```typescript
let sender = createEmailSender(currentProvider as EmailProviderType);
```

New:
```typescript
import { createRobustSender } from "./sender.factory";

let sender = createRobustSender({ provider: currentProvider as EmailProviderType });
```

And update the `POST /provider` handler in `provider.routes.ts` to also use the factory.

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: all tests pass (if any use the server, the health endpoint should now include CB state)

- [ ] **Step 4: Commit**

```bash
git add src/sender.factory.ts src/server.ts src/routes/provider.routes.ts
git commit -m "feat: add sender factory with retry + CB + logging"
```

---

### Task 9: Health Route Tests

**Files:**
- Test: `tests/routes/health.routes.test.ts`

- [ ] **Step 1: Write health route tests**

```typescript
// tests/routes/health.routes.test.ts
import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registerHealthRoutes } from "../../src/routes/health.routes";

describe("GET /health", () => {
  it("returns ok when circuit breaker is closed", async () => {
    const fastify = Fastify();
    registerHealthRoutes(fastify, {
      getProvider: () => "null",
      getCircuitBreakerState: () => "closed",
    });

    const res = await fastify.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "ok", circuitBreaker: "closed" });
  });

  it("returns degraded when circuit breaker is open", async () => {
    const fastify = Fastify();
    registerHealthRoutes(fastify, {
      getProvider: () => "smtp",
      getCircuitBreakerState: () => "open",
    });

    const res = await fastify.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: "degraded", circuitBreaker: "open" });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/routes/health.routes.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: PASS — all tests

- [ ] **Step 4: Commit**

```bash
git add tests/routes/health.routes.test.ts
git commit -m "test: add health endpoint tests"
```
