/**
 * Landing behaviour for the reference markup: the runtime the saved page lost
 * (reveal, grid shimmer, jump rail, menu, Drawing mode) plus Raho's demos.
 * Everything is local. Nothing here talks to a chain.
 */
import { chainConfig, contractsReady, tokenDisplay } from "../config/index.ts";
import { copyText } from "../shared/clipboard.ts";
import { $, $$, reducedMotion, wait } from "../shared/dom.ts";
import { clock } from "../shared/format.ts";

const still = reducedMotion();
const root = document.documentElement;

/* Drawing (light) and blueprint (dark) modes */
function initMode(): void {
  const button = $<HTMLButtonElement>("#arc-mode-toggle");
  const sync = () => {
    const drawing = root.dataset.mode === "drawing";
    if (button) {
      button.textContent = drawing ? "Blueprint" : "Drawing";
      button.setAttribute("aria-label", drawing ? "Switch to blueprint (dark) mode" : "Switch to drawing (light) mode");
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", drawing ? "#F4F1E9" : "#0D1524");
  };
  button?.addEventListener("click", () => {
    root.dataset.mode = root.dataset.mode === "drawing" ? "blueprint" : "drawing";
    try {
      localStorage.setItem("raho.mode", root.dataset.mode);
    } catch {
      /* Storage blocked: the switch still works for this visit. */
    }
    sync();
  });
  sync();
}

/* Mobile menu */
function initMenu(): void {
  const header = $(".arc-header");
  const toggle = $<HTMLButtonElement>("#arc-menu-toggle");
  if (!header || !toggle) return;
  const set = (open: boolean) => {
    header.dataset.menu = open ? "open" : "closed";
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  toggle.addEventListener("click", () => set(header.dataset.menu !== "open"));
  header.addEventListener("click", (e) => {
    if ((e.target as Element).closest("#arc-menu a")) set(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && header.dataset.menu === "open") {
      set(false);
      toggle.focus();
    }
  });
}

/* Scroll reveal: the reference marks revealed elements with .arc-in */
function initReveal(): void {
  const items = $$("[data-reveal]");
  if (still || !("IntersectionObserver" in window)) {
    for (const el of items) el.classList.add("arc-in");
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("arc-in");
        io.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  for (const el of items) io.observe(el);
}

/* The light sweep along the grid, once each time a plate comes into view */
function initShimmer(): void {
  if (still) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (!entry.isIntersecting || el.classList.contains("arc-run")) continue;
        el.classList.add("arc-run");
        el.addEventListener("animationend", () => el.classList.remove("arc-run"), { once: true });
      }
    },
    { threshold: 0.35 },
  );
  for (const el of $$("[data-shimmer]")) io.observe(el);
}

/* Jump rail: appears after the hero and tracks the current section */
function initJump(): void {
  const rail = $("#arc-jump");
  const links = $$<HTMLAnchorElement>("[data-jump]");
  const sections = links.map((a) => document.getElementById(a.dataset.jump!)).filter((s): s is HTMLElement => !!s);
  if (!rail || !sections.length) return;
  let frame = 0;
  const update = () => {
    frame = 0;
    const line = innerHeight * 0.4;
    let id = sections[0].id;
    for (const s of sections) if (s.getBoundingClientRect().top <= line) id = s.id;
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) id = sections[sections.length - 1].id;
    for (const a of links) {
      if (a.dataset.jump === id) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    }
    rail.classList.toggle("is-visible", scrollY > innerHeight * 0.6);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule);
  update();
}

/* Token contract address: always from src/config, never invented */
function initContractAddress(): void {
  const box = $("[data-contract-address]");
  if (!box) return;
  const token = tokenDisplay();
  const value = $("[data-ca-value]", box)!;
  const button = $<HTMLButtonElement>("[data-ca-copy]", box)!;
  const status = $(".arc-ca__status", box)!;
  value.textContent = token.label;
  button.setAttribute("aria-label", token.live ? "Copy token contract address" : "Copy token contract address. Not available yet");
  let timer = 0;
  button.addEventListener("click", async () => {
    status.textContent = token.live ? ((await copyText(token.copyValue)) ? "Copied" : "Copy failed") : "Not available yet";
    status.classList.add("is-shown");
    clearTimeout(timer);
    timer = window.setTimeout(() => status.classList.remove("is-shown"), 1800);
  });
}

/* Hero dimension line as the request path: agent, Raho gate, wallet, chain */
function initHeroPath(): void {
  const dim = $("[data-hero-path]");
  if (!dim || still) return;
  const figure = $("[data-path-figure]", dim)!;
  const gate = $("[data-path-gate]", dim)!;
  const dot = $("[data-path-dot]", dim)!;
  const steps = [
    { req: "TRANSFER 50 USDC", d: "ALLOW" },
    { req: "APPROVE() UNKNOWN", d: "REVIEW" },
    { req: "SEND TOKEN X", d: "BLOCK" },
    { req: "SWAP 80 USDC", d: "ALLOW" },
    { req: "TRANSFER 500 USDC", d: "REVIEW" },
  ];
  let at = 0;
  const move = (to: number, ms: number) => {
    const from = at;
    at = to;
    return dot.animate([{ left: `${from}%` }, { left: `${to}%` }], { duration: ms, easing: "cubic-bezier(.45,0,.2,1)", fill: "forwards" }).finished;
  };
  const fade = (to: number, ms: number) => dot.animate([{}, { opacity: to }], { duration: ms, fill: "forwards" }).finished;

  let running = false;
  let loop: Promise<void> | null = null;
  const run = async () => {
    for (let i = 0; running; i++) {
      const { req, d } = steps[i % steps.length];
      delete gate.dataset.d;
      delete dot.dataset.d;
      figure.innerHTML = `<span class="arc-dim__req">${req}</span>`;
      at = 0;
      await fade(1, 250);
      await move(40, 900);
      await wait(350);
      gate.dataset.d = d;
      dot.dataset.d = d;
      figure.innerHTML = `<span class="arc-dim__req">${req}</span> → <span data-d="${d}">${d}</span>`;
      if (d === "BLOCK") {
        await wait(1100);
        await fade(0, 400);
      } else {
        await wait(d === "REVIEW" ? 1500 : 500);
        await move(100, 1000);
        await fade(0, 300);
      }
      await wait(700);
    }
    delete gate.dataset.d;
    figure.textContent = "ALLOW · REVIEW · BLOCK";
    loop = null;
  };
  let inView = false;
  const sync = () => {
    running = inView && document.visibilityState === "visible";
    if (running && !loop) loop = run();
  };
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    sync();
  }).observe(dim);
  document.addEventListener("visibilitychange", sync);
}

/* Session line, emergency controls and human review share one small state */
const demo = { paused: false, revoked: false, locked: false, resetAt: 0 };
let renderSession = () => {};

function initSession(): void {
  const box = $("[data-session]");
  if (!box) return;
  const LENGTH = 2 * 3_600_000;
  const figure = $("[data-session-clock]", box)!;
  const remain = $("[data-session-remain]", box)!;
  const label = $("[data-session-label]", box)!;
  const expiresAt = Date.now() + LENGTH - 20_000;
  renderSession = () => {
    const left = Math.max(0, expiresAt - Date.now());
    const blocked = demo.revoked || demo.locked;
    figure.textContent = demo.locked ? "LOCKED" : demo.revoked ? "REVOKED" : demo.paused ? "PAUSED" : clock(left);
    figure.style.color = blocked ? "var(--arc-limit)" : "";
    remain.style.transform = `scaleX(${demo.revoked ? 0 : left / LENGTH})`;
    remain.style.background = blocked ? "var(--arc-limit)" : "";
    const state = demo.locked ? "LOCKED" : demo.revoked ? "REVOKED" : demo.paused ? "PAUSED" : "ACTIVE";
    label.textContent =
      state === "ACTIVE"
        ? "RESEARCH AGENT · ACTIVE · USDC ONLY · $100 MAX · EXPIRES IN 2 HOURS"
        : `RESEARCH AGENT · ${state} · NEW REQUESTS BLOCK`;
  };
  renderSession();
  setInterval(renderSession, 1000);
}

function initControls(): void {
  const status = $("[data-control-status]");
  const LABELS = {
    pause: ["Pause agent →", "Resume agent →"],
    revoke: ["Revoke session →", "Open a new session →"],
    lock: ["Engage lock →", "Release lock →"],
  } as const;
  const render = () => {
    for (const key of ["pause", "revoke", "lock"] as const) {
      const on = key === "pause" ? demo.paused : key === "revoke" ? demo.revoked : demo.locked;
      const button = $<HTMLButtonElement>(`[data-emergency="${key}"]`)!;
      button.textContent = LABELS[key][on ? 1 : 0];
      button.setAttribute("aria-pressed", String(on));
      const panel = button.closest<HTMLElement>(".arc-panel")!;
      if (on) panel.dataset.state = key === "lock" ? "locked" : "on";
      else delete panel.dataset.state;
    }
    const recent = Date.now() - demo.resetAt < 3500;
    const reset = $<HTMLButtonElement>('[data-emergency="reset"]')!;
    reset.textContent = recent ? "Limits restored ✓" : "Reset limits →";
    const firewall = demo.locked ? "LOCKED" : demo.paused || demo.revoked ? "RESTRICTED" : "ARMED";
    if (status) status.textContent = `FIREWALL ${firewall} · DEMO CONTROLS · NOTHING IS SENT ONCHAIN`;
    renderSession();
  };
  for (const button of $$<HTMLButtonElement>("[data-emergency]")) {
    button.addEventListener("click", () => {
      const key = button.dataset.emergency;
      if (key === "pause") demo.paused = !demo.paused;
      else if (key === "revoke") demo.revoked = !demo.revoked;
      else if (key === "lock") demo.locked = !demo.locked;
      else {
        demo.resetAt = Date.now();
        setTimeout(render, 3600);
      }
      render();
    });
  }
  render();
}

function initReview(): void {
  const card = $("[data-review-card]");
  if (!card) return;
  const code = $("[data-review-code]", card)!;
  const actions = $("[data-review-actions]", card)!;
  const original = actions.innerHTML;
  const show = (state: "pending" | "approved" | "rejected") => {
    if (state === "pending") {
      delete card.dataset.review;
      code.textContent = "AMOUNT_ABOVE_AUTO_LIMIT";
      actions.innerHTML = original;
      return;
    }
    card.dataset.review = state;
    code.textContent = state === "approved" ? "APPROVED · THIS REQUEST ONLY" : "REJECTED · NOTHING IS SIGNED";
    actions.innerHTML = '<button type="button" class="arc-link" data-review="reset">Show again →</button>';
    $<HTMLButtonElement>("[data-review]", actions)?.focus({ preventScroll: true });
  };
  card.addEventListener("click", (e) => {
    const action = (e.target as Element).closest<HTMLElement>("[data-review]")?.dataset.review;
    if (action === "approve") show("approved");
    else if (action === "reject") show("rejected");
    else if (action === "reset") show("pending");
  });
}

function initDeployment(): void {
  if (!contractsReady()) return;
  const network = chainConfig.chainName || "mainnet";
  const status = $("[data-deploy-status]");
  if (status) status.textContent = `CONTRACTS LIVE ON ${network.toUpperCase()}`;
  const footer = $("[data-footer-status]");
  if (footer) footer.textContent = `Raho contracts are live on ${network}.`;
}

initMode();
initMenu();
initReveal();
initShimmer();
initJump();
initContractAddress();
initHeroPath();
initSession();
initControls();
initReview();
initDeployment();
