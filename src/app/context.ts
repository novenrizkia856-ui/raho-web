import type { RahoAdapter, RahoState } from "../lib/raho/index.ts";

/** What every view receives. */
export interface AppContext {
  raho: RahoAdapter;
  state: RahoState;
  now: number;
  /** Current query, e.g. `agent=payment` from `#/policies?agent=payment`. */
  params: URLSearchParams;
  navigate(path: string): void;
  /** Run a store change without re-rendering the current view (used by editors). */
  quietly(fn: () => Promise<void>): Promise<void>;
}

export interface View {
  title: string;
  kicker: string;
  render(ctx: AppContext): string;
  /** Wire view specific listeners after render. */
  bind?(root: HTMLElement, ctx: AppContext): void;
}
