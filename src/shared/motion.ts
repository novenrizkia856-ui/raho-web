/**
 * Reveal on scroll and the grid shimmer, the reference's two signature moves.
 * Both respect prefers-reduced-motion.
 */
import { $$, reducedMotion } from "./dom.ts";

export function initReveal(root: ParentNode = document): void {
  const items = $$("[data-reveal]", root);
  if (reducedMotion() || !("IntersectionObserver" in window)) {
    for (const el of items) el.classList.add("is-in");
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  for (const el of items) io.observe(el);
}

/** Runs the light sweep along the grid once each time a plate enters view. */
export function initShimmer(): void {
  if (reducedMotion() || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (!entry.isIntersecting || el.classList.contains("is-running")) continue;
        el.classList.add("is-running");
        el.addEventListener("animationend", () => el.classList.remove("is-running"), { once: true });
      }
    },
    { threshold: 0.35 },
  );
  for (const el of $$("[data-shimmer]")) io.observe(el);
}

/** Calls `fn(true)` while the element is on screen and the tab is visible. */
export function whenVisible(el: Element, fn: (visible: boolean) => void, threshold = 0.2): void {
  let inView = false;
  let last: boolean | undefined;
  const update = () => {
    const visible = inView && document.visibilityState === "visible";
    if (visible !== last) fn((last = visible));
  };
  new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      update();
    },
    { threshold },
  ).observe(el);
  document.addEventListener("visibilitychange", update);
}
