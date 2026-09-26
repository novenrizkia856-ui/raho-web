/**
 * Landing runtime for the reference markup. The saved page kept only the end
 * state of each animation, so this puts the motion back: the hero intro, the
 * connector draw, blur in reveals, the pinned pipeline and the turning
 * compatibility wheel. Everything is local. Nothing here talks to a chain.
 */
import { chainConfig, contractsReady, tokenDisplay } from "../config/index.ts";
import { copyText } from "../shared/clipboard.ts";
import { $, $$, reducedMotion } from "../shared/dom.ts";

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

/* Pipeline: pinned while the stages build left to right */
function initPipeline(): void {
  const pipe = $("[data-pipe]");
  const track = $("[data-pipe-track]");
  if (!pipe || !track) return;
  const steps = $$("[data-pipe-step]", track);
  const set = (el: HTMLElement, on: boolean) => {
    if (el.hasAttribute("data-pipe-line")) el.style.clipPath = on ? "inset(0px 0% 0px 0px)" : "inset(0 100% 0 0)";
    else if (el.hasAttribute("data-pipe-vline")) el.style.clipPath = on ? "inset(0 0 0% 0)" : "inset(0 0 100% 0)";
    else {
      el.style.opacity = on ? "1" : "0";
      el.style.transform = on ? "none" : "translateX(12px)";
    }
  };
  const parts = (step: HTMLElement) => $$("[data-pipe-item], [data-pipe-line], [data-pipe-vline]", step);

  if (still) {
    for (const step of steps) for (const el of parts(step)) set(el, true);
    track.style.transform = "translateX(40px)";
    return;
  }
  let frame = 0;
  const update = () => {
    frame = 0;
    if (innerWidth < 1024) return;
    const rect = pipe.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - innerHeight)));
    const end = Math.min(40, innerWidth - 1738 - 40);
    track.style.transform = `translateX(${540 + (end - 540) * Math.min(1, p / 0.85)}px)`;
    steps.forEach((step, i) => {
      parts(step).forEach((el, j) => set(el, i === 0 ? p >= j * 0.004 : p >= i * 0.22 + j * 0.012));
    });
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
initContractAddress();
initDeployment();
