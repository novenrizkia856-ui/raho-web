/**
 * Hero dimension line as a request path: a request leaves the agent, stops at
 * the Raho gate, then carries on to the wallet and chain, waits for a human,
 * or ends at the gate.
 */
import type { Decision } from "../lib/raho/types.ts";
import { $, esc, reducedMotion, wait } from "../shared/dom.ts";
import { whenVisible } from "../shared/motion.ts";

const SEQUENCE: { label: string; d: Decision }[] = [
  { label: "Transfer 50 USDC", d: "ALLOW" },
  { label: "approve() unknown contract", d: "REVIEW" },
  { label: "Send 200 TOKEN X", d: "BLOCK" },
  { label: "Swap 80 USDC", d: "ALLOW" },
  { label: "Transfer 500 USDC", d: "REVIEW" },
  { label: "upgrade() call", d: "BLOCK" },
];

const STOPS = { agent: 0, raho: 40, wallet: 72, chain: 100 } as const;

export function initSchematic(): void {
  const root = $("[data-schematic]");
  if (!root || reducedMotion()) return;
  const figure = $("[data-flow-figure]", root)!;
  const packet = $("[data-packet]", root)!;
  const stop = (name: keyof typeof STOPS) => $(`[data-stop="${name}"]`, root)!;
  const gate = stop("raho");

  let at = 0;
  const move = async (to: number, duration: number) => {
    const from = at;
    at = to;
    await packet.animate([{ left: `${from}%` }, { left: `${to}%` }], { duration, easing: "cubic-bezier(.45,0,.2,1)", fill: "forwards" }).finished;
  };
  const fade = (opacity: number, duration: number, extra: Keyframe = {}) =>
    packet.animate([{}, { opacity, ...extra }], { duration, easing: "ease", fill: "forwards" }).finished;

  const reset = () => {
    delete gate.dataset.d;
    delete packet.dataset.d;
    for (const el of root.querySelectorAll(".is-lit")) el.classList.remove("is-lit");
  };

  async function play(step: { label: string; d: Decision }) {
    reset();
    figure.innerHTML = `<span class="rh-dim__req">${esc(step.label)}</span>`;
    at = STOPS.agent;
    packet.style.left = "0%";
    stop("agent").classList.add("is-lit");
    await fade(1, 250);
    await move(STOPS.raho, 900);
    stop("agent").classList.remove("is-lit");
    gate.classList.add("is-lit");
    await wait(450);

    gate.dataset.d = step.d;
    packet.dataset.d = step.d;
    figure.innerHTML = `<span class="rh-dim__req">${esc(step.label)}</span> · <span class="rh-dim__verdict" data-d="${step.d}">${step.d}</span>`;

    if (step.d === "BLOCK") {
      await wait(900);
      await fade(0, 450, { transform: "translateY(14px)" });
      await wait(700);
      return;
    }
    await wait(step.d === "REVIEW" ? 1400 : 500);
    gate.classList.remove("is-lit");
    stop("wallet").classList.add("is-lit");
    await move(STOPS.wallet, 650);
    await wait(250);
    stop("wallet").classList.remove("is-lit");
    stop("chain").classList.add("is-lit");
    await move(STOPS.chain, 600);
    await fade(0, 300);
    await wait(700);
  }

  let running = false;
  let loop: Promise<void> | null = null;
  let index = 0;
  const run = async () => {
    while (running) await play(SEQUENCE[index++ % SEQUENCE.length]);
    reset();
    figure.textContent = "Allow · Review · Block";
    loop = null;
  };

  whenVisible(root, (visible) => {
    running = visible;
    if (visible && !loop) loop = run();
  });
}
