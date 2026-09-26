/**
 * "Allow. Review. Block." A sample request, the policy checks lighting up in
 * order from the real engine's trace, and the decision panel.
 */
import type { Decision } from "../lib/raho/types.ts";
import { $, $$, esc, reducedMotion, wait } from "../shared/dom.ts";
import { whenVisible } from "../shared/motion.ts";
import { FLOW_SAMPLES, run } from "./examples.ts";

const WALLET: Record<Decision, string> = {
  ALLOW: "Wallet open · Passed to the signer",
  REVIEW: "Wallet held · Waiting for you",
  BLOCK: "Wallet closed · Nothing signed",
};

export function initFlow(): void {
  const root = $("[data-flow]");
  if (!root) return;
  const presets = $(".rh-flow__presets", root)!;
  const decision = $('[data-stage="decision"]', root)!;
  const arrows = $$(".rh-flow__arrow", root);
  const checks = $("[data-flow-checks]", root)!;
  const text = (key: string) => $(`[data-flow-${key}]`, root)!;
  const instant = reducedMotion();

  presets.innerHTML = FLOW_SAMPLES.map(
    (s, i) =>
      `<button type="button" class="rh-preset" data-i="${i}" aria-pressed="false"><span class="rh-preset__dot" aria-hidden="true"></span>${esc(s.label)}</button>`,
  ).join("");

  let token = 0;
  let current = -1;
  let auto = true;
  const pause = (ms: number) => (instant ? Promise.resolve() : wait(ms));

  async function show(i: number) {
    const my = ++token;
    const alive = () => my === token;
    current = i;
    const sample = FLOW_SAMPLES[i];
    const result = run(sample.request);

    for (const b of $$<HTMLButtonElement>(".rh-preset", presets)) b.setAttribute("aria-pressed", String(Number(b.dataset.i) === i));
    for (const a of arrows) a.classList.remove("is-on");
    delete decision.dataset.d;
    text("request").textContent = sample.label;
    text("agent").textContent = sample.agent;
    text("fn").textContent = sample.request.fn;
    text("verdict").textContent = "Waiting";
    text("message").textContent = "Checks run in order.";
    text("wallet").textContent = "Wallet closed";
    checks.innerHTML = result.checks.map((c) => `<li class="rh-flow__check"><b>${esc(c.label)}</b><em></em></li>`).join("");

    await pause(350);
    if (!alive()) return;
    arrows[0].classList.add("is-on");
    const rows = $$(".rh-flow__check", checks);
    for (const [n, c] of result.checks.entries()) {
      await pause(c.result === "skip" ? 60 : 180);
      if (!alive()) return;
      rows[n].dataset.r = c.result;
      rows[n].querySelector("em")!.textContent = c.result === "skip" ? "Skipped" : c.detail;
    }
    await pause(250);
    if (!alive()) return;
    arrows[1].classList.add("is-on");
    decision.dataset.d = result.decision;
    text("verdict").textContent = result.decision;
    text("message").textContent = result.message;
    text("wallet").textContent = WALLET[result.decision];
    text("live").textContent = `${sample.label}: ${result.decision}. ${result.message}`;
  }

  presets.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(".rh-preset");
    if (!button) return;
    auto = false;
    void show(Number(button.dataset.i));
  });

  if (instant) {
    void show(0);
    return;
  }

  let timer = 0;
  whenVisible(
    root,
    (visible) => {
      clearInterval(timer);
      if (!visible || !auto) return;
      if (current === -1) void show(0);
      timer = window.setInterval(() => {
        if (!auto) return clearInterval(timer);
        void show((current + 1) % FLOW_SAMPLES.length);
      }, 5200);
    },
    0.35,
  );
}
