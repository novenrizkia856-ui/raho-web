/**
 * Landing runtime for the reference markup. The saved page kept only the end
 * state of each animation, so this puts the motion back: the hero intro, the
 * connector draw, blur in reveals, the pinned pipeline, the turning
 * compatibility wheel and the section artwork. Everything is local. Nothing
 * here talks to a chain.
 */
import { chainConfig, contractsReady, tokenDisplay } from "../config/index.ts";
import { copyText } from "../shared/clipboard.ts";
import { $, $$, reducedMotion } from "../shared/dom.ts";
import { initArt } from "./art.ts";

const still = reducedMotion();
const EASE = "cubic-bezier(.22,1,.36,1)";

const hide = (el: HTMLElement, y = 20) => {
  el.style.opacity = "0";
  el.style.filter = "blur(10px)";
  el.style.transform = `translateY(${y}px)`;
};
const show = (el: HTMLElement, delay = 0, duration = 900) => {
  el.style.transition = `opacity ${duration}ms ease ${delay}ms, filter ${duration}ms ease ${delay}ms, transform ${duration}ms ${EASE} ${delay}ms`;
  el.style.opacity = "1";
  el.style.filter = "blur(0px)";
  el.style.transform = "none";
};

/* Mobile menu */
function initMenu(): void {
  const header = $("header[data-menu]");
  const toggle = $<HTMLButtonElement>("[data-menu-toggle]");
  if (!header || !toggle) return;
  const set = (open: boolean) => {
    header.dataset.menu = open ? "open" : "closed";
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  toggle.addEventListener("click", () => set(header.dataset.menu !== "open"));
  header.addEventListener("click", (e) => {
    if ((e.target as Element).closest(".raho-menu a")) set(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && header.dataset.menu === "open") {
      set(false);
      toggle.focus();
    }
  });
}

/* Hero intro: headline lines, copy, card and the row below arrive one after another */
function initHeroIntro(): void {
  if (still) return;
  const items = $$("[data-hero-in]");
  const paths = Array.from(document.querySelectorAll<SVGPathElement>("[data-draw]"));
  items.forEach((el) => hide(el, 24));
  for (const p of paths) p.style.strokeDashoffset = "1";
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      items.forEach((el, i) => show(el, 120 + i * 140, 1000));
      paths.forEach((p, i) => {
        p.style.transition = `stroke-dashoffset 900ms ${EASE} ${900 + i * 250}ms`;
        p.style.strokeDashoffset = "0";
      });
    }),
  );
}

/* The card walks through the migration: each call lights up in turn */
function initHeroStages(): void {
  const stage = $("[data-hero-stage]");
  const chips = $$("[data-hero-chip]");
  if (!stage || chips.length !== 3) return;
  const labels = ["Detect", "Migrate", "Active"];
  let i = 0;
  const render = () => {
    stage.textContent = labels[i];
    stage.dataset.d = i === 2 ? "ALLOW" : "REVIEW";
    chips.forEach((chip, j) => {
      chip.style.transition = "color .4s ease, box-shadow .4s ease";
      chip.style.color = j === i ? "#fefefe" : "";
      chip.style.boxShadow =
        j === i ? "inset 0 1px 1px #db898975, 0 0 0 1px rgba(254,6,0,.55), 0 10px 30px -8px rgba(254,6,0,.7)" : "";
    });
  };
  render();
  if (still) return;
  setInterval(() => {
    i = (i + 1) % labels.length;
    render();
  }, 2200);
}

/* Blur in reveals for every section below the hero */
function initReveal(): void {
  if (still || !("IntersectionObserver" in window)) return;
  const finals = ["opacity:1;filter:blur(0px);transform:none", "opacity:1;filter:none;transform:none", "opacity:1;transform:none"];
  const items = $$("[style]").filter(
    (el) => finals.includes(el.getAttribute("style") ?? "") && !el.closest("#top") && !el.hasAttribute("data-pipe-item"),
  );
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        // Siblings that enter together cascade, as the reference does.
        const group = Array.from(el.parentElement?.children ?? []).filter((c) => items.includes(c as HTMLElement));
        show(el, Math.max(0, group.indexOf(el)) * 110);
        io.unobserve(el);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
  );
  for (const el of items) {
    hide(el);
    io.observe(el);
  }
}

/*
 * Pipeline: the stage stays pinned for 400vh while the steps build, as in the
 * reference. Desktop moves the track one step per quarter of the scroll and
 * staggers that step in. Below 1024px a centred track follows the scroll, and
 * each part fades or draws inside its own window of it.
 */
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const EASE_OUT = "cubic-bezier(0,0,.58,1)";

function pipeDesktop(): ((p: number) => void) | null {
  const track = $("[data-pipe-track]");
  if (!track) return null;
  const steps = $$("[data-pipe-step]", track);
  // Where each step settles, as a share of its width, from the reference layout.
  const ANCHOR = [0.49, 0.37, 0.24, 0.35];
  const seen = steps.map(() => false);
  let active = 0;
  let placed = false;

  const set = (el: HTMLElement, on: boolean, delay: number, duration: number) => {
    const d = on ? `${duration}s ${EASE_OUT} ${delay}s` : ".3s ease 0s";
    if (el.hasAttribute("data-pipe-line") || el.hasAttribute("data-pipe-vline")) {
      if (!still) el.style.transition = `clip-path ${d}`;
      el.style.clipPath = el.hasAttribute("data-pipe-line")
        ? on ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)"
        : on ? "inset(0 0 0% 0)" : "inset(0 0 100% 0)";
    } else {
      if (!still) el.style.transition = `opacity ${d}, transform ${d}`;
      el.style.opacity = on ? "1" : "0";
      el.style.transform = on ? "none" : "translateX(12px)";
    }
  };

  const render = () => {
    steps.forEach((step, i) => {
      const on = still || (seen[i] && i <= active);
      Array.from(step.children as HTMLCollectionOf<HTMLElement>).forEach((part, j) => {
        const delay = 0.4 + j * 0.22;
        set(part, on, delay, part.hasAttribute("data-pipe-line") ? 0.6 : 0.5);
        // Inside a column: the connector draws with it, the chips follow one by one.
        const vline = $("[data-pipe-vline]", part);
        if (vline) set(vline, on, delay, 0.4 + Number($("svg", vline)?.getAttribute("height") ?? 0) / 400);
        $$("[data-pipe-item]", part).forEach((chip, k) => set(chip, on, delay + 0.35 + k * 0.12, 0.4));
      });
    });
  };

  const place = () => {
    const step = steps[active];
    const left = step.getBoundingClientRect().left - track.getBoundingClientRect().left;
    const x = innerWidth / 2 - 32 - (left + step.offsetWidth * ANCHOR[active]);
    track.style.transition = placed && !still ? "transform .8s cubic-bezier(.25,.1,.25,1)" : "none";
    track.style.transform = `translateX(${x.toFixed(1)}px)`;
    placed = true;
  };

  // A step builds once it has been on screen and the scroll has reached it.
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        seen[steps.indexOf(entry.target as HTMLElement)] = true;
        io.unobserve(entry.target);
      }
      render();
    },
    { rootMargin: "-50px" },
  );
  steps.forEach((step) => io.observe(step));
  render();

  return (p) => {
    const next = Math.min(steps.length - 1, Math.floor(p * steps.length));
    if (next !== active) {
      active = next;
      render();
    }
    place();
  };
}

function pipeMobile(): ((p: number) => void) | null {
  const track = $("[data-mpipe-track]");
  if (!track) return null;
  const parts = $$("[data-m]", track);
  // Scroll windows per group, from the reference: a step's head, then its columns.
  const WINDOWS = [[0, 0.03], [0.12, 0.18], [0.25, 0.28], [0.37, 0.4], [0.44, 0.47], [0.5, 0.53], [0.62, 0.68], [0.75, 0.78], [0.9, 1]];
  let times: number[] = [];
  let xs: number[] = [];

  // Each group, as it lands, is brought to the centre of the screen.
  const measure = () => {
    const bounds = WINDOWS.map(() => [Infinity, -Infinity]);
    const origin = track.getBoundingClientRect().left;
    for (const el of parts) {
      if (el.hasAttribute("data-m-vline")) continue;
      const r = el.getBoundingClientRect();
      const b = bounds[Number(el.dataset.m)];
      b[0] = Math.min(b[0], r.left - origin);
      b[1] = Math.max(b[1], r.right - origin);
    }
    times = [];
    xs = [];
    let x = 45;
    WINDOWS.forEach(([from, to], g) => {
      times.push(from, to);
      xs.push(x, (x = -(bounds[g][0] + bounds[g][1]) / 2));
    });
  };

  const trackX = (p: number) => {
    let i = 1;
    while (i < times.length - 1 && p > times[i]) i++;
    const span = times[i] - times[i - 1];
    return xs[i - 1] + (xs[i] - xs[i - 1]) * (span > 0 ? clamp01((p - times[i - 1]) / span) : 1);
  };

  measure();
  document.fonts?.ready.then(measure);
  addEventListener("resize", measure);

  return (p) => {
    track.style.transform = `translateX(${trackX(p).toFixed(1)}px)`;
    for (const el of parts) {
      const [from, to] = WINDOWS[Number(el.dataset.m)];
      const t = still ? 1 : clamp01((p - from) / (to - from));
      if (el.hasAttribute("data-m-line")) el.style.clipPath = `inset(0 ${(100 - t * 100).toFixed(1)}% 0 0)`;
      else if (el.hasAttribute("data-m-vline")) el.style.clipPath = `inset(0 0 ${(100 - t * 100).toFixed(1)}% 0)`;
      else el.style.opacity = t.toFixed(3);
    }
  };
}

function initPipeline(): void {
  const pipe = $("[data-pipe]");
  if (!pipe) return;
  const desktop = pipeDesktop();
  const mobile = pipeMobile();
  let frame = 0;
  const update = () => {
    frame = 0;
    const rect = pipe.getBoundingClientRect();
    const p = clamp01(-rect.top / Math.max(1, rect.height - innerHeight));
    (innerWidth >= 1024 ? desktop : mobile)?.(p);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  update();
}

/* Compatibility wheel: the artwork turns (CSS) and one icon at a time lights white */
function initWheel(): void {
  const icons = Array.from(document.querySelectorAll<SVGGElement>("[data-fly]"));
  if (icons.length < 2 || still) return;
  let i = 0;
  const render = () => icons.forEach((g, j) => (g.style.color = j === i ? "white" : "rgb(254,6,0)"));
  render();
  setInterval(() => {
    i = (i + 1) % icons.length;
    render();
  }, 1600);
}

/* Token contract address: always from src/config, never invented */
function initContractAddress(): void {
  const box = $("[data-contract-address]");
  if (!box) return;
  const token = tokenDisplay();
  $("[data-ca-value]", box)!.textContent = token.label;
  const button = $<HTMLButtonElement>("[data-ca-copy]", box)!;
  const toast = $("[data-ca-toast]", box)!;
  const message = $("[data-ca-message]", box)!;
  button.setAttribute("aria-label", token.live ? "Copy token contract address" : "Copy token contract address. Not available yet");
  let timer = 0;
  button.addEventListener("click", async () => {
    message.textContent = token.live ? ((await copyText(token.copyValue)) ? "Copied" : "Copy failed") : "Not available yet";
    toast.classList.add("is-shown");
    clearTimeout(timer);
    timer = window.setTimeout(() => toast.classList.remove("is-shown"), 1800);
  });
}

function initDeployment(): void {
  if (!contractsReady()) return;
  const status = $("[data-deploy-status]");
  if (status) status.textContent = `Contracts live on ${chainConfig.chainName || "mainnet"}`;
}

initHeroIntro();
initHeroStages();
initMenu();
initReveal();
initPipeline();
initWheel();
initArt();
initContractAddress();
initDeployment();
