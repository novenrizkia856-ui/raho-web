/** Rendering helpers shared by the app views. Views return HTML strings. */
import { effectiveSessionStatus } from "../lib/raho/selectors.ts";
import type { ActivityEntry, Agent, RahoState, Session } from "../lib/raho/types.ts";
import { chip } from "../shared/chip.ts";
import { $, esc } from "../shared/dom.ts";
import { clock, duration } from "../shared/format.ts";

export const agentName = (state: RahoState, id: string): string => state.agents.find((a) => a.id === id)?.name ?? id;

export const icon = {
  overview: '<path d="M3 3h6v8H3zM11 3h6v5h-6zM11 10h6v7h-6zM3 13h6v4H3z"/>',
  agents: '<circle cx="10" cy="6.5" r="3.2"/><path d="M3.5 17c.9-3.4 3.3-5 6.5-5s5.6 1.6 6.5 5"/>',
  policies: '<path d="M10 2.5 16 5v4.8c0 3.7-2.6 6.4-6 7.7-3.4-1.3-6-4-6-7.7V5z"/><path d="m7.2 9.8 2 2 3.6-3.8"/>',
  sessions: '<circle cx="10" cy="10.5" r="6.5"/><path d="M10 6.5v4l2.6 1.6M8 2h4"/>',
  activity: '<path d="M2.5 10h3.2l2-5 4.2 10 2-5h3.6"/>',
  approvals: '<path d="M4 3.5h12v9H9l-4 3.5v-3.5H4z"/><path d="m7.5 8 1.8 1.8L12.8 6.4"/>',
  controls: '<rect x="4" y="9" width="12" height="8.5" rx="1.2"/><path d="M6.8 9V6.6a3.2 3.2 0 0 1 6.4 0V9"/>',
  settings: '<circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6"/>',
  close: '<path d="m5 5 10 10M15 5 5 15"/>',
} as const;

export const svg = (name: keyof typeof icon, size = 18) =>
  `<svg viewBox="0 0 20 20" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${icon[name]}</svg>`;

/** A live countdown. The app ticker refreshes every [data-countdown] once a second. */
export const countdown = (expiresAt: number, format: "clock" | "short" = "short") =>
  `<span class="rh-countdown" data-countdown="${expiresAt}" data-format="${format}">${
    format === "clock" ? clock(expiresAt - Date.now()) : duration(expiresAt - Date.now())
  }</span>`;

export function sessionChip(session: Session | undefined, now = Date.now()): string {
  const s = effectiveSessionStatus(session, now);
  return s === "none" ? chip("none", "No session") : chip(s);
}

export const agentChip = (agent: Agent) => chip(agent.status === "active" ? "active" : "paused");

export function meter(value: number, max: number, label?: string): string {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const tone = pct >= 100 ? "block" : pct >= 80 ? "review" : "allow";
  return `<span class="rh-meter-bar" data-tone="${tone}" role="img" aria-label="${esc(label ?? `${Math.round(pct)} percent used`)}"><span style="width:${pct.toFixed(1)}%"></span></span>`;
}

export const empty = (title: string, note: string) =>
  `<div class="rh-empty"><strong>${esc(title)}</strong><span>${esc(note)}</span></div>`;

export function traceList(entry: ActivityEntry): string {
  return `<ol class="rh-trace rh-trace--static">${entry.evaluation.checks
    .map(
      (c, i) =>
        `<li data-r="${c.result}"><span class="rh-trace__n">${String(i + 1).padStart(2, "0")}</span><span class="rh-trace__label">${esc(c.label)}</span><span class="rh-trace__detail">${esc(c.result === "skip" ? "Not reached" : c.detail)}</span>${chip(c.result, c.result === "skip" ? "Skipped" : undefined)}</li>`,
    )
    .join("")}</ol>`;
}

/* Toasts */
export function toast(message: string, decision?: string): void {
  const host = $("[data-toasts]");
  if (!host) return;
  const el = document.createElement("div");
  el.className = "rh-toast";
  if (decision) el.dataset.d = decision;
  el.textContent = message;
  host.append(el);
  setTimeout(() => {
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 260);
  }, 3600);
}

/* Modal */
export interface ModalOptions {
  title: string;
  kicker?: string;
  body: string;
  confirm?: string;
  cancel?: string;
  danger?: boolean;
  /** Return false to keep the dialog open. */
  onConfirm?: (dialog: HTMLDialogElement) => boolean | void | Promise<boolean | void>;
  onOpen?: (dialog: HTMLDialogElement) => void;
}

export function openModal(options: ModalOptions): HTMLDialogElement {
  const dialog = $<HTMLDialogElement>("[data-modal]")!;
  dialog.innerHTML = `
    <form method="dialog" class="rh-modal__form" novalidate>
      <div class="rh-modal__head">
        <div>
          ${options.kicker ? `<span class="rh-kicker${options.danger ? " rh-kicker--limit" : ""}">${esc(options.kicker)}</span>` : ""}
          <h2 class="rh-subhead rh-modal__title" id="rh-modal-title">${esc(options.title)}</h2>
        </div>
        <button type="button" class="rh-icon-btn" data-close aria-label="Close">${svg("close", 16)}</button>
      </div>
      <div class="rh-modal__body">${options.body}</div>
      <div class="rh-modal__foot">
        <button type="button" class="rh-btn rh-btn--ghost rh-btn--sm" data-close>${esc(options.cancel ?? "Cancel")}</button>
        ${options.confirm ? `<button type="submit" class="rh-btn rh-btn--sm${options.danger ? " rh-btn--danger" : ""}" data-confirm>${esc(options.confirm)}</button>` : ""}
      </div>
    </form>`;
  const form = dialog.querySelector("form")!;
  for (const b of dialog.querySelectorAll("[data-close]")) b.addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const keep = (await options.onConfirm?.(dialog)) === false;
    if (!keep) dialog.close();
  });
  dialog.showModal();
  options.onOpen?.(dialog);
  return dialog;
}

export const confirmAction = (options: Omit<ModalOptions, "body"> & { body?: string }) =>
  openModal({ ...options, body: options.body ?? "" });
