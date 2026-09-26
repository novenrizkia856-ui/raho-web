import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/app.css";
import "../styles/migration.css";

import { shortAddress } from "../config/index.ts";
import { getRaho } from "../lib/raho/index.ts";
import { connectWallet, getWallet, onWallet } from "../lib/wallet.ts";
import { $ } from "../shared/dom.ts";
import { renderView, routes, type Route } from "./views.ts";

const raho = getRaho();
const shell = $(".rh-shell")!;
const view = $("[data-view]")!;
const nav = $("[data-side-nav]")!;
const known = new Set(routes.map((route) => route.id));
const currentRoute = (): Route => {
  const name = location.hash.replace(/^#\/?/, "").split("?")[0];
  return known.has(name as Route) ? name as Route : "overview";
};

function render(): void {
  const route = currentRoute();
  const state = raho.getState();
  nav.innerHTML = routes.map((item) => `<a class="rh-side__link" href="#/${item.id}" ${route === item.id ? 'aria-current="page"' : ""}><span class="rm-nav-glyph" aria-hidden="true">${item.glyph}</span><span>${item.label}</span></a>`).join("");
  $("[data-view-title]")!.textContent = routes.find((item) => item.id === route)!.label;
  $("[data-view-kicker]")!.textContent = "RAHO / DEMO";
  document.title = `${routes.find((item) => item.id === route)!.label} | Raho`;
  view.innerHTML = `<div class="rh-view__inner is-entering">${renderView(route, state)}</div>`;
  $("[data-side-status]")!.innerHTML = `<span class="rh-side__dot" aria-hidden="true"></span><span><strong>${state.stage === "ACTIVE" ? "Demo active" : "Migration layer"}</strong><span>${state.stage.replaceAll("_", " ").toLowerCase()}</span></span>`;
  const wallet = getWallet();
  $("[data-wallet-btn]")!.textContent = wallet.status === "connected" ? shortAddress(wallet.address) : wallet.status === "connecting" ? "Connecting" : "Connect wallet";
  $("[data-demo-pill]")!.textContent = "DEMO MODE";
}

function toast(message: string): void {
  const host = $("[data-toasts]")!;
  const el = document.createElement("div");
  el.className = "rh-toast";
  el.textContent = message;
  host.append(el);
  setTimeout(() => el.remove(), 4000);
}

async function runFlow(id: string): Promise<void> {
  try {
    switch (id) {
      case "detect": await raho.detectAuthentication(); break;
      case "prepare": await raho.preparePostQuantumKey(($<HTMLSelectElement>("#scheme")?.value) ?? raho.getState().selectedSchemeId); break;
      case "compatibility": await raho.checkCompatibility(); break;
      case "build": await raho.buildMigration(); break;
      case "review": await raho.reviewMigration(); break;
      case "execute": await raho.submitMigration(); toast("Demo state advanced. Nothing was sent onchain."); break;
      case "verify": await raho.verifyMigration(); break;
      case "activate": await raho.activatePostQuantumAuth(); break;
      case "rotate": await raho.rotateKey(($<HTMLSelectElement>("#rotation-scheme")?.value) ?? raho.getState().selectedSchemeId); toast("Rotation intent prepared locally."); break;
      case "reset": await raho.resetDemo(); location.hash = "#/overview"; toast("Demo data reset."); break;
    }
    if (id !== "reset") location.hash = id === "rotate" ? "#/keys" : "#/migrate";
    render();
  } catch (error) { toast(error instanceof Error ? error.message : "Action unavailable."); }
}

document.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;
  if (target.closest(".rh-side__link")) shell.dataset.nav = "closed";
  const flow = target.closest<HTMLElement>("[data-flow]");
  if (flow) { await runFlow(flow.dataset.flow!); return; }
  const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
  if (action === "open-nav") shell.dataset.nav = "open";
  if (action === "close-nav") shell.dataset.nav = "closed";
  if (action === "connect-wallet") {
    try {
      const wallet = await connectWallet();
      if (wallet.status === "connected") {
        await raho.selectAccount(wallet.address);
        toast("Wallet address selected. Authentication remains demo data.");
      }
    } catch { toast("Wallet connection unavailable."); }
  }
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape") shell.dataset.nav = "closed"; });
window.addEventListener("hashchange", () => { render(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); });
raho.subscribe(render);
onWallet(render);
render();
