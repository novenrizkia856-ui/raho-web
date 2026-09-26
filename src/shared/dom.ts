/** Tiny DOM helpers. No framework: the pages are mostly static markup. */
export function $<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(selector);
}

export function $$<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape text before it goes into an HTML template. */
export const esc = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c]);

export const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
