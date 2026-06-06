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
