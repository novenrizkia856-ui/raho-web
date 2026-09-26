/**
 * "Allow. Review. Block." A sample request moves through the stages and the
 * policy checks light up in order, using the real engine's trace.
 */
import type { Decision } from "../lib/raho/types.ts";
import { $, $$, esc, reducedMotion, wait } from "../shared/dom.ts";
import { whenVisible } from "../shared/motion.ts";
import { FLOW_SAMPLES, run } from "./examples.ts";

const WALLET: Record<Decision, [string, string]> = {
  ALLOW: ["Open", "Passed to the signer"],
  REVIEW: ["Held", "Waiting for your approval"],
  BLOCK: ["Closed", "Nothing reaches the wallet"],
};

export function initFlow(): void {
  const root = $("[data-flow]");
  if (!root) return;
  const presets = $(".rh-flow__presets", root)!;
  const stages = Object.fromEntries($$("[data-stage]", root).map((el) => [el.dataset.stage!, el]));
  const links = $$(".rh-flow__link", root);
  const gate = $("[data-flow-gate]", root)!;
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
    current = i;
    const sample = FLOW_SAMPLES[i];
    const result = run(sample.request);
    const alive = () => my === token;

    for (const b of $$<HTMLButtonElement>(".rh-preset", presets)) b.setAttribute("aria-pressed", String(Number(b.dataset.i) === i));
    for (const el of Object.values(stages)) {
      el.classList.remove("is-active");
      delete el.dataset.d;
    }
    for (const l of links) l.classList.remove("is-on");
    delete gate.dataset.d;
    text("request").textContent = sample.label;
    text("agent").textContent = sample.agent;
    text("decoded").textContent = sample.request.fn;
    text("verdict").textContent = "Waiting";
    text("reason").textContent = "";
    text("wallet").textContent = "Closed";
    text("wallet-note").textContent = "Nothing signed yet";
    checks.innerHTML = result.checks
      .map((c) => `<li class="rh-flow__check" data-key="${c.key}"><b>${esc(c.label)}</b><em></em></li>`)
      .join("");

    stages.agent.classList.add("is-active");
    await pause(380);
    if (!alive()) return;
    links[0].classList.add("is-on");
    await pause(320);
    stages.firewall.classList.add("is-active");
    await pause(420);
    if (!alive()) return;
    links[1].classList.add("is-on");
    await pause(260);
    stages.policy.classList.add("is-active");

    const rows = $$(".rh-flow__check", checks);
    for (const [n, c] of result.checks.entries()) {
      if (!alive()) return;
      rows[n].dataset.r = c.result;
      rows[n].querySelector("em")!.textContent = c.result === "skip" ? "Skipped" : c.detail;
      await pause(c.result === "skip" ? 60 : 170);
    }

    await pause(200);
    if (!alive()) return;
    links[2].classList.add("is-on");
    await pause(260);
    stages.decision.dataset.d = result.decision;
    stages.decision.classList.add("is-active");
    text("verdict").textContent = result.decision;
    text("reason").textContent = result.reason;
    await pause(420);
    if (!alive()) return;
    gate.dataset.d = result.decision;
    gate.classList.add("is-on");
    await pause(300);
    stages.wallet.dataset.d = result.decision;
    text("wallet").textContent = WALLET[result.decision][0];
    text("wallet-note").textContent = WALLET[result.decision][1];
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

  // Cycle through the samples while the section is on screen, until someone picks one.
  let timer = 0;
  whenVisible(root, (visible) => {
    clearInterval(timer);
    if (!visible || !auto) return;
    if (current === -1) void show(0);
    timer = window.setInterval(() => {
      if (!auto) return clearInterval(timer);
      void show((current + 1) % FLOW_SAMPLES.length);
    }, 5200);
  }, 0.35);
}
