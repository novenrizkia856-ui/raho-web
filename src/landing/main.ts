/**
 * Landing runtime for the reference markup: the behaviour the saved page lost
 * (blur in reveals, scroll driven pipeline, mobile menu) plus Raho's demos.
 * Everything is local. Nothing here talks to a chain.
 */
import { chainConfig, contractsReady, tokenDisplay } from "../config/index.ts";
import { copyText } from "../shared/clipboard.ts";
import { $, $$, reducedMotion } from "../shared/dom.ts";
import { clock } from "../shared/format.ts";
import { initHeroScales } from "./hero-scales.ts";

const still = reducedMotion();

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

/* Blur in reveals: the saved page kept only the final state of each animation */
function initReveal(): void {
  if (still || !("IntersectionObserver" in window)) return;
  const finals = ["opacity:1;filter:blur(0px);transform:none", "opacity:1;filter:none;transform:none"];
  const items = $$("[style]").filter((el) => finals.includes(el.getAttribute("style") ?? "") && !el.closest("#top"));
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.style.opacity = "1";
        el.style.filter = "blur(0px)";
        el.style.transform = "none";
        io.unobserve(el);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
  );
  items.forEach((el, i) => {
    el.style.transition = `opacity .8s ease ${(i % 4) * 90}ms, filter .8s ease ${(i % 4) * 90}ms, transform .8s cubic-bezier(.2,.7,.2,1) ${(i % 4) * 90}ms`;
    el.style.opacity = "0";
    el.style.filter = "blur(10px)";
    el.style.transform = "translateY(20px)";
    io.observe(el);
  });
}

/* Pipeline: steps appear and the track slides while the section is pinned */
function initPipeline(): void {
  const pipe = $("[data-pipe]");
  const track = $("[data-pipe-track]");
  if (!pipe || !track) return;
  const steps = $$("[data-pipe-step]", track);
  const show = (el: HTMLElement, on: boolean) => {
    if (el.hasAttribute("data-pipe-line")) el.style.clipPath = on ? "inset(0px 0% 0px 0px)" : "inset(0 100% 0 0)";
    else if (el.hasAttribute("data-pipe-vline")) el.style.clipPath = on ? "inset(0 0 0% 0)" : "inset(0 0 100% 0)";
    else {
      el.style.opacity = on ? "1" : "0";
      el.style.transform = on ? "none" : "translateX(12px)";
    }
  };
  const all = (step: HTMLElement) => $$("[data-pipe-item], [data-pipe-line], [data-pipe-vline]", step);

  if (still) {
    for (const step of steps) for (const el of all(step)) show(el, true);
    track.style.transform = "translateX(40px)";
    return;
  }

  let frame = 0;
  const update = () => {
    frame = 0;
    if (innerWidth < 1024) return;
    const rect = pipe.getBoundingClientRect();
    const span = rect.height - innerHeight;
    const p = Math.min(1, Math.max(0, -rect.top / Math.max(1, span)));
    const end = Math.min(40, innerWidth - 1738 - 40);
    track.style.transform = `translateX(${540 + (end - 540) * Math.min(1, p / 0.85)}px)`;
    steps.forEach((step, i) => {
      const on = p >= i * 0.22;
      const parts = all(step);
      parts.forEach((el, j) => show(el, on && p >= i * 0.22 + j * 0.012));
    });
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  update();
}

/* Hero card: the third chip cycles through the three outcomes */
function initHeroVerdict(): void {
  const verdict = $("[data-hero-verdict]");
  const outcome = $("[data-hero-outcome]");
  if (!verdict || !outcome) return;
  const states = [
    { d: "ALLOW", label: "Allow", chip: "wallet.sign()" },
    { d: "REVIEW", label: "Review", chip: "owner.review()" },
    { d: "BLOCK", label: "Block", chip: "request.block()" },
  ];
  let i = 0;
  const render = () => {
    const s = states[i % states.length];
    verdict.dataset.d = s.d;
    verdict.textContent = s.label;
    outcome.textContent = s.chip;
  };
  render();
  if (still) return;
  setInterval(() => {
    i++;
    render();
  }, 2600);
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

/* Human review card */
function initReview(): void {
  const card = $("[data-review-card]");
  if (!card) return;
  const text = $("[data-card-text]", card)!;
  const actions = $("[data-card-actions]", card)!;
  const original = { text: text.textContent ?? "", actions: actions.innerHTML };
  card.addEventListener("click", (e) => {
    const action = (e.target as Element).closest<HTMLElement>("[data-review]")?.dataset.review;
    if (!action) return;
    if (action === "reset") {
      delete card.dataset.state;
      text.textContent = original.text;
      actions.innerHTML = original.actions;
      return;
    }
    card.dataset.state = action === "approve" ? "approved" : "rejected";
    text.textContent =
      action === "approve" ? "Approved by you. This one request may proceed. Demo only." : "Rejected by you. Nothing was signed. Demo only.";
    const reset = actions.querySelector<HTMLElement>('[data-review="reject"]') ?? actions.lastElementChild;
    actions.innerHTML = "";
    if (reset instanceof HTMLElement) {
      reset.dataset.review = "reset";
      reset.querySelector("span")!.textContent = "Show Again";
      actions.append(reset);
      reset.focus({ preventScroll: true });
    }
  });
}

/* Emergency controls and the live session card share one small state */
const demo = { pause: false, revoke: false, lock: false };

function initSession(): () => void {
  const card = $("[data-session]");
  if (!card) return () => {};
  const LENGTH = 2 * 3_600_000;
  const clockEl = $("[data-session-clock]", card)!;
  const bar = $("[data-session-bar]", card)!;
  const tag = $("[data-session-tag]", card)!;
  const small = $("small", card)!;
  const expiresAt = Date.now() + LENGTH - 20_000;
  const render = () => {
    const left = Math.max(0, expiresAt - Date.now());
    const state = demo.lock ? "Locked" : demo.revoke ? "Revoked" : demo.pause ? "Paused" : "Active";
    clockEl.textContent = state === "Active" ? clock(left) : state;
    clockEl.style.color = state === "Active" ? "" : "#fe0600";
    bar.style.width = `${state === "Revoked" ? 0 : (left / LENGTH) * 100}%`;
    tag.textContent = state === "Active" ? "Active" : `${state} · New requests block`;
    small.textContent = state === "Active" ? "Time left" : "New requests block";
  };
  render();
  setInterval(render, 1000);
  return render;
}

function initControls(renderSession: () => void): void {
  const LABELS: Record<keyof typeof demo, [string, string]> = {
    pause: ["Pause Agent", "Resume Agent"],
    revoke: ["Revoke Session", "Open New Session"],
    lock: ["Engage Lock", "Release Lock"],
  };
  for (const button of $$<HTMLButtonElement>("[data-emergency]")) {
    const key = button.dataset.emergency as keyof typeof demo;
    button.addEventListener("click", () => {
      demo[key] = !demo[key];
      button.setAttribute("aria-pressed", String(demo[key]));
      button.querySelector("span")!.textContent = LABELS[key][demo[key] ? 1 : 0];
      button.closest(".bg-card-interactive")?.classList.toggle("is-engaged", demo[key]);
      renderSession();
    });
  }
}

function initDeployment(): void {
  if (!contractsReady()) return;
  const status = $("[data-deploy-status]");
  if (status) status.textContent = `Contracts live on ${chainConfig.chainName || "mainnet"}`;
}

initHeroScales();
initMenu();
initReveal();
initPipeline();
initHeroVerdict();
initContractAddress();
initReview();
initControls(initSession());
initDeployment();
