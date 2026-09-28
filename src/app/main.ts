import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/app.css";
import "../styles/migration.css";

import { chainConfig, shortAddress } from "../config/index.ts";
import * as raho from "../lib/raho/index.ts";
import { connectWallet, getWallet, onWallet, restoreWallet, switchNetwork } from "../lib/wallet.ts";
import { copyText } from "../shared/clipboard.ts";
import { $, esc } from "../shared/dom.ts";
import { icon, renderView, routes, stageLabel, type Route } from "./views.ts";

const shell = $(".rh-shell")!;
const view = $("[data-view]")!;
const nav = $("[data-side-nav]")!;
const modal = $<HTMLDialogElement>("[data-modal]")!;
const known = new Set(routes.map((route) => route.id));
const currentRoute = (): Route => {
  const name = location.hash.replace(/^#\/?/, "").split("?")[0];
  return known.has(name as Route) ? name as Route : "overview";
};

/** Keep typed form values across re-renders. */
function keepInputs(fn: () => void): void {
  const values = new Map<string, string>();
  view.querySelectorAll<HTMLInputElement>("input[id]").forEach((input) => values.set(input.id, input.value));
  const focused = document.activeElement instanceof HTMLInputElement ? document.activeElement.id : "";
  fn();
  values.forEach((value, id) => { const input = view.querySelector<HTMLInputElement>(`#${id}`); if (input) input.value = value; });
  if (focused) view.querySelector<HTMLInputElement>(`#${focused}`)?.focus();
}

let lastRoute: Route | null = null;
function render(): void {
  const route = currentRoute();
  const s = raho.getState();
  nav.innerHTML = routes.map((item) => `<a class="rh-side__link" href="#/${item.id}" ${route === item.id ? 'aria-current="page"' : ""}>${icon(item.id, 18, "rm-nav-glyph")}<span>${item.label}</span></a>`).join("");
  $("[data-view-title]")!.textContent = routes.find((item) => item.id === route)!.label;
  $("[data-view-kicker]")!.textContent = `RAHO / ${chainConfig.chainName.toUpperCase() || "OFFLINE"}`;
  document.title = `${routes.find((item) => item.id === route)!.label} | Raho`;
  const entering = route !== lastRoute;
  lastRoute = route;
  keepInputs(() => { view.innerHTML = `<div class="rh-view__inner ${entering ? "is-entering" : ""}">${renderView(route, s)}</div>`; });
  $("[data-side-status]")!.innerHTML = `<span class="rh-side__dot" aria-hidden="true"></span><span><strong>${esc(stageLabel(s.stage))}</strong><span>${esc(s.busy ?? (s.loading ? "Reading chain" : chainConfig.chainName))}</span></span>`;
  const wallet = getWallet();
  $("[data-wallet-btn]")!.textContent = wallet.status === "connected" ? shortAddress(wallet.address) : wallet.status === "connecting" ? "Connecting" : "Connect wallet";
  const pill = $("[data-demo-pill]")!;
  pill.textContent = s.stage === "NETWORK" ? "WRONG NETWORK" : chainConfig.chainName.toUpperCase();
  pill.title = `Live on ${chainConfig.chainName}. Transactions are real.`;
}

function toast(message: string): void {
  const host = $("[data-toasts]")!;
  const el = document.createElement("div");
  el.className = "rh-toast";
  el.textContent = message;
  host.append(el);
  setTimeout(() => el.remove(), 5000);
}

/** Small modal. Resolves true when the primary button is pressed. */
function dialog(title: string, body: string, primary: string, onOpen?: () => void): Promise<boolean> {
  modal.innerHTML = `<form method="dialog"><div class="rh-modal__head"><h2 class="rh-subhead" id="rh-modal-title">${esc(title)}</h2></div><div class="rh-modal__body">${body}</div><div class="rh-modal__foot"><button class="rh-btn rh-btn--ghost" value="cancel">Cancel</button><button class="rh-btn" value="ok" data-modal-ok>${esc(primary)}</button></div></form>`;
  onOpen?.();
  modal.showModal();
  return new Promise((resolve) => modal.addEventListener("close", () => resolve(modal.returnValue === "ok"), { once: true }));
}

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text + "\n"], { type: "text/plain" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function showBackup(backup: string): Promise<void> {
  const account = raho.getState().account?.address ?? "account";
  const ok = await dialog("Back up your PQ key", `<p class="rm-note">This line is the seed of every PQ key for this account. After migration it is the only way to control the account.</p><textarea class="rh-input rh-input--mono rm-backup" readonly rows="3" data-backup>${esc(backup)}</textarea><div class="rm-panel__foot"><button type="button" class="rh-btn rh-btn--ghost" data-backup-copy>Copy</button><button type="button" class="rh-btn rh-btn--ghost" data-backup-download>Download</button></div><label class="rm-confirm"><input type="checkbox" data-backup-ack> I stored this backup offline and understand it cannot be recovered.</label>`, "Confirm backup", () => {
    const okBtn = $<HTMLButtonElement>("[data-modal-ok]", modal)!;
    okBtn.disabled = true;
    $<HTMLInputElement>("[data-backup-ack]", modal)!.addEventListener("change", (e) => { okBtn.disabled = !(e.target as HTMLInputElement).checked; });
    $("[data-backup-copy]", modal)!.addEventListener("click", async () => toast((await copyText(backup)) ? "Backup copied." : "Copy failed."));
    $("[data-backup-download]", modal)!.addEventListener("click", () => download(`raho-pq-backup-${account.slice(2, 8)}.txt`, backup));
  });
  if (ok) { raho.confirmBackup(); toast("Backup confirmed."); }
}

const confirmStep = (title: string, text: string, primary: string) => dialog(title, `<p class="rm-note">${esc(text)}</p>`, primary);
const inputValue = (id: string) => $<HTMLInputElement>(`#${id}`)?.value ?? "";

async function runFlow(id: string): Promise<void> {
  try {
    switch (id) {
      case "connect": await connectWallet(); break;
      case "switch-network": await switchNetwork(); break;
      case "create-account": await raho.createAccount(); toast("Smart account created."); break;
      case "generate": await showBackup(raho.generateKey().backup); break;
      case "regenerate":
        if (!await confirmStep("Replace browser key", "The current browser key is not registered and does not control the account. A new seed replaces it.", "Replace")) return;
        await showBackup(raho.generateKey().backup); break;
      case "backup": { const backup = raho.currentBackup(); if (backup) await showBackup(backup); break; }
      case "import": raho.importBackup(inputValue("import-backup")); toast("Backup imported."); break;
      case "register": await raho.registerKey(); toast("PQ key registered."); break;
      case "rotate":
        if (!await confirmStep("Rotate PQ key", "A new key from your seed replaces the registered one. An open migration must be closed first.", "Rotate")) return;
        await raho.registerKey(); toast("PQ key rotated. Run a migration to apply it."); break;
      case "create-migration": await raho.createMigration(); toast("Migration created."); break;
      case "prepare": await raho.prepareMigration(); toast("Migration ready."); break;
      case "execute":
        if (!await confirmStep("Execute migration", "Your wallet will no longer control this account. Only your PQ key backup will. Continue only if the backup is safe.", "Execute")) return;
        await raho.executeMigration(); toast("Migration executed."); break;
      case "verify": await raho.verifyMigration(); toast("Migration verified."); break;
      case "activate": await raho.activateMigration(); toast("Post quantum authentication active."); break;
      case "cancel":
        if (!await confirmStep("Cancel migration", "The open migration is closed. An executed switch is not rolled back.", "Cancel migration")) return;
        await raho.cancelMigration(); toast("Migration cancelled."); break;
      case "send": await raho.sendFromAccount(inputValue("send-to"), inputValue("send-amount")); toast("Sent."); break;
      case "copy-account": { const a = raho.getState().account?.address; if (a) toast((await copyText(a)) ? "Address copied." : "Copy failed."); break; }
    }
  } catch (error) {
    toast(raho.message(error));
  }
  render();
}

document.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;
  if (target.closest(".rh-side__link")) shell.dataset.nav = "closed";
  const flow = target.closest<HTMLElement>("[data-flow]");
  if (flow && !(flow as HTMLButtonElement).disabled) { await runFlow(flow.dataset.flow!); return; }
  const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
  if (action === "open-nav") shell.dataset.nav = "open";
  if (action === "close-nav") shell.dataset.nav = "closed";
  if (action === "connect-wallet") {
    if (getWallet().status === "connected") { location.hash = "#/accounts"; return; }
    await runFlow("connect");
  }
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape") shell.dataset.nav = "closed"; });
window.addEventListener("hashchange", () => { render(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); });
raho.subscribe(render);
onWallet(render);
render();
void restoreWallet().finally(() => raho.start());
