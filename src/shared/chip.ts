import { esc } from "./dom.ts";
import { titleCase } from "./format.ts";

/** Decision or status chip. `state` drives colour, `label` defaults to the state. */
export const chip = (state: string, label?: string, extra = ""): string =>
  `<span class="rh-chip ${extra}" data-d="${esc(state)}">${esc(label ?? titleCase(state))}</span>`;
