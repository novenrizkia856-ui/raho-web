/**
 * Hero schematic: requests leave the agent, stop at Raho, and either pass to
 * the wallet, wait for a human, or end at the stop terminal.
 */
import type { Decision } from "../lib/raho/types.ts";
import { $, reducedMotion, wait } from "../shared/dom.ts";
import { whenVisible } from "../shared/motion.ts";

const SEQUENCE: { label: string; d: Decision }[] = [
  { label: "Transfer 50 USDC", d: "ALLOW" },
  { label: "approve() unknown", d: "REVIEW" },
  { label: "Send 200 TOKEN X", d: "BLOCK" },
  { label: "Swap 80 USDC", d: "ALLOW" },
  { label: "Transfer 500 USDC", d: "REVIEW" },
  { label: "upgrade() call", d: "BLOCK" },
];

type Point = { x: number; y: number };

export function initSchematic(): void {
  const grid = $("[data-schematic]");
  const figure = grid?.closest<HTMLElement>(".rh-schematic");
  const packet = $("[data-packet]", grid ?? document);
  if (!grid || !figure || !packet) return;
  if (reducedMotion()) return;

  const node = (name: string) => $(`[data-node="${name}"]`, grid)!;
  const wire = (name: string) => $(`[data-wire="${name}"]`, grid)!;
  const raho = node("raho");
  const stamp = $("[data-stamp]", raho)!;

  const center = (el: HTMLElement): Point => ({ x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop + el.offsetHeight / 2 });
  const topEdge = (el: HTMLElement): Point => ({ x: el.offsetLeft + el.offsetWidth / 2, y: el.offsetTop });

  let at: Point = { x: 0, y: 0 };
  const place = (p: Point) => `translate(${p.x - packet.offsetWidth / 2}px, ${p.y - packet.offsetHeight / 2}px)`;

  const move = async (to: Point, duration: number, easing = "cubic-bezier(.45,0,.2,1)") => {
    const from = at;
    at = to;
    await packet.animate([{ transform: place(from) }, { transform: place(to) }], { duration, easing, fill: "forwards" }).finished;
  };

  const fade = (to: number, duration: number, scale = 1) =>
    packet.animate([{ opacity: Number(getComputedStyle(packet).opacity) }, { opacity: to, transform: `${place(at)} scale(${scale})` }], {
      duration,
      easing: "ease",
      fill: "forwards",
    }).finished;

  const reset = () => {
    delete raho.dataset.d;
    delete packet.dataset.d;
    delete figure.dataset.active;
    stamp.classList.remove("is-shown");
    for (const el of grid.querySelectorAll(".is-lit")) el.classList.remove("is-lit");
  };

  let running = false;
  let loop: Promise<void> | null = null;
  let index = 0;

  const play = async (step: { label: string; d: Decision }) => {
    reset();
    packet.textContent = step.label;
    at = center(wire("a"));
    packet.style.transform = place(at);
    await fade(1, 260);
    await move(topEdge(raho), 700);

    raho.classList.remove("is-scanning");
    void raho.offsetWidth;
    raho.classList.add("is-scanning");
    await wait(620);
    raho.classList.remove("is-scanning");

    raho.dataset.d = step.d;
    packet.dataset.d = step.d;
    figure.dataset.active = step.d;
    stamp.textContent = step.d;
    stamp.style.color = `var(--rh-${step.d.toLowerCase()}-text)`;
    stamp.classList.add("is-shown");

    if (step.d === "BLOCK") {
      node("stop").classList.add("is-lit");
      await packet.animate(
        [0, -6, 6, -4, 3, 0].map((dx) => ({ transform: `${place({ x: at.x + dx, y: at.y })}` })),
        { duration: 380, easing: "ease-out" },
      ).finished;
      await wait(420);
      await fade(0, 420, 0.86);
      await wait(500);
      return;
    }

    if (step.d === "REVIEW") {
      node("human").classList.add("is-lit");
      await wait(1100);
      node("human").classList.remove("is-lit");
    } else {
      await wait(250);
    }

    await move(center(wire("b")), 520);
    node("wallet").classList.add("is-lit");
    await move(center(wire("c")), 620);
    node("wallet").classList.remove("is-lit");
    node("chain").classList.add("is-lit");
    await move(topEdge(node("chain")), 360);
    await fade(0, 320);
    await wait(420);
  }

  const runLoop = async () => {
    while (running) {
      await play(SEQUENCE[index % SEQUENCE.length]);
      index++;
    }
    reset();
    loop = null;
  }

  whenVisible(figure, (visible) => {
    running = visible;
    if (visible && !loop) loop = runLoop();
  });

  window.addEventListener("resize", () => {
    packet.style.transform = place(at);
  });
}
