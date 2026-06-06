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
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  machine.onEnter("closed", () => {
    clearTimeout(timeoutHandle);
    timeoutHandle = undefined;
  });

  function scheduleTimeout() {
    timeoutHandle = setTimeout(() => {
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
