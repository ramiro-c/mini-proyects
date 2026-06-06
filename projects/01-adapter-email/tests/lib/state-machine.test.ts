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
		m.onEnter("running", () => {
			entered = "running";
		});
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
