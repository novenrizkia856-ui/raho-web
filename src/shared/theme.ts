/** Blueprint (dark) and Drawing (light) modes, as in the reference. */
import { $$ } from "./dom.ts";

type Mode = "blueprint" | "drawing";
const KEY = "raho.mode";

const current = (): Mode => (document.documentElement.dataset.mode === "drawing" ? "drawing" : "blueprint");

function apply(mode: Mode): void {
  document.documentElement.dataset.mode = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", mode === "drawing" ? "#f4f1e9" : "#0d1524");
  syncModeButtons();
}

/** Labels every mode button with the mode it switches to. */
export function syncModeButtons(): void {
  const mode = current();
  for (const button of $$<HTMLButtonElement>("[data-mode-toggle]")) {
    const next = mode === "drawing" ? "Blueprint" : "Drawing";
    button.textContent = next;
    button.setAttribute("aria-label", `Switch to ${next.toLowerCase()} mode`);
  }
}

export function toggleMode(): void {
  const next: Mode = current() === "drawing" ? "blueprint" : "drawing";
  apply(next);
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* Not persisted when storage is blocked. */
  }
}

export function initModeToggle(): void {
  apply(current());
  for (const button of $$<HTMLButtonElement>("[data-mode-toggle]")) button.addEventListener("click", toggleMode);
}
