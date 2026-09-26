import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/app.css";

import { shortAddress } from "../config/index.ts";
import { getRaho } from "../lib/raho/index.ts";
import { pendingApprovals } from "../lib/raho/selectors.ts";
import { getWallet, onWallet } from "../lib/wallet.ts";
import { $, $$ } from "../shared/dom.ts";
import { clock, duration } from "../shared/format.ts";
import { syncModeButtons, toggleMode } from "../shared/theme.ts";
import { handleAction } from "./actions.ts";
import type { AppContext, View } from "./context.ts";
import { svg } from "./ui.ts";
import { activity } from "./views/activity.ts";
import { agents } from "./views/agents.ts";
import { approvals } from "./views/approvals.ts";
import { controls } from "./views/controls.ts";
import { overview } from "./views/overview.ts";
import { policies } from "./views/policies.ts";
import { sessions } from "./views/sessions.ts";
import { settings } from "./views/settings.ts";

const ROUTES: Record<string, View & { icon: Parameters<typeof svg>[0]; nav: string }> = {
  overview: { ...overview, icon: "overview", nav: "Overview" },
  agents: { ...agents, icon: "agents", nav: "Agents" },
  policies: { ...policies, icon: "policies", nav: "Policies" },
  sessions: { ...sessions, icon: "sessions", nav: "Sessions" },
  activity: { ...activity, icon: "activity", nav: "Activity" },
  approvals: { ...approvals, icon: "approvals", nav: "Approvals" },
  controls: { ...controls, icon: "controls", nav: "Controls" },
  settings: { ...settings, icon: "settings", nav: "Settings" },
};

const raho = getRaho();
const shell = $(".rh-shell")!;
const viewEl = $("[data-view]")!;
const sideNav = $("[data-side-nav]")!;

let quiet = false;
let lastRoute = "";

function parseHash(): { route: string; params: URLSearchParams } {
  const [path, query = ""] = location.hash.replace(/^#\/?/, "").split("?");
  return { route: ROUTES[path] ? path : "overview", params: new URLSearchParams(query) };
}

const navigate = (path: string) => {
  location.hash = `#${path.startsWith("/") ? path : `/${path}`}`;
};

function context(params: URLSearchParams): AppContext {
  return {
    raho,
    state: raho.getState(),
    now: Date.now(),
    params,
    navigate,
    async quietly(fn) {
      quiet = true;
      try {
        await fn();
      } finally {
        quiet = false;
      }
      renderChrome();
    },
  };
}

function renderChrome(): void {
  const state = raho.getState();
  const { route } = parseHash();
  const pending = pendingApprovals(state).length;
  sideNav.innerHTML = Object.entries(ROUTES)
    .map(
      ([key, r]) =>
        `<a class="rh-side__link" href="#/${key}"${key === route ? ' aria-current="page"' : ""}>${svg(r.icon)}<span>${r.nav}</span>${
          key === "approvals" && pending ? `<span class="rh-badge" aria-label="${pending} waiting">${pending}</span>` : ""
        }${key === "controls" && state.locked ? '<span class="rh-badge rh-badge--limit">Lock</span>' : ""}</a>`,
    )
    .join("");

  const active = state.agents.filter((a) => a.status === "active").length;
  $("[data-side-status]")!.innerHTML = `
    <span class="rh-side__dot" data-level="${state.locked ? "locked" : "armed"}" aria-hidden="true"></span>
    <span><strong>${state.locked ? "Locked" : "Armed"}</strong><span>${active} of ${state.agents.length} agents active</span></span>`;

  const lockbar = $("[data-lockbar]")!;
  lockbar.hidden = !state.locked;
  shell.dataset.locked = String(state.locked);

  const wallet = getWallet();
  const btn = $<HTMLButtonElement>("[data-wallet-btn]")!;
  btn.textContent = wallet.status === "connected" ? shortAddress(wallet.address) : wallet.status === "connecting" ? "Connecting" : "Connect wallet";
  btn.dataset.action = wallet.status === "connected" ? "open-settings" : "connect-wallet";
  btn.title = wallet.status === "connected" ? "Connected, read only. Open settings." : "";

  $("[data-demo-pill]")!.hidden = raho.mode !== "demo";
}

function render(): void {
  const { route, params } = parseHash();
  const view = ROUTES[route];
  const ctx = context(params);
  const changedRoute = route !== lastRoute;
  lastRoute = route;

  document.title = `${view.nav} · Raho`;
  $("[data-view-title]")!.textContent = view.title;
  $("[data-view-kicker]")!.textContent = view.kicker;

  // A fresh container each render, so listeners bound by the last view go with it.
  const y = window.scrollY;
  const inner = document.createElement("div");
  inner.className = "rh-view__inner";
  inner.innerHTML = view.render(ctx);
  viewEl.replaceChildren(inner);
  view.bind?.(inner, ctx);
  syncModeButtons();
  renderChrome();

  if (changedRoute) {
    window.scrollTo({ top: 0 });
    inner.classList.add("is-entering");
  } else {
    window.scrollTo({ top: y });
  }
}

/* Once a second: countdowns, session rings, and a repaint when a session ends. */
function tick(): void {
  const now = Date.now();
  let expired = false;
  for (const el of $$("[data-countdown]")) {
    const end = Number(el.dataset.countdown);
    el.textContent = el.dataset.format === "clock" ? clock(end - now) : duration(end - now);
    if (end <= now && !el.dataset.done) {
      el.dataset.done = "1";
      expired = true;
    }
  }
  for (const el of $$("[data-ring-end]")) {
    const start = Number(el.dataset.ringStart);
    const end = Number(el.dataset.ringEnd);
    if (end) el.style.setProperty("--p", String(Math.max(0, ((end - now) / (end - start)) * 100)));
  }
  if (expired && !document.querySelector("dialog[open]")) render();
}

function setNav(open: boolean): void {
  shell.dataset.nav = open ? "open" : "closed";
  $("[data-action='open-nav']")?.setAttribute("aria-expanded", String(open));
}

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest("[data-mode-toggle]")) return toggleMode();
  if (target.closest(".rh-side__link")) setNav(false);
  const el = target.closest<HTMLElement>("[data-action]");
  if (!el || (el as HTMLButtonElement).disabled) return;
  const action = el.dataset.action;
  if (action === "open-nav") return setNav(true);
  if (action === "close-nav") return setNav(false);
  if (action === "open-settings") return navigate("/settings");
  void handleAction(raho, el, navigate);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && shell.dataset.nav === "open") setNav(false);
});

raho.subscribe(() => {
  if (quiet) return;
  if (document.querySelector("dialog[open]")) {
    // Let the dialog finish; repaint once it closes.
    $("[data-modal]")!.addEventListener("close", render, { once: true });
    return renderChrome();
  }
  render();
});

onWallet(() => {
  renderChrome();
  if (["overview", "settings"].includes(parseHash().route)) render();
});

window.addEventListener("hashchange", () => {
  render();
  viewEl.focus({ preventScroll: true });
});

render();
setInterval(tick, 1000);
