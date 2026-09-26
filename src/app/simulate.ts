/**
 * Simulate request: build a request the way an agent integration would send
 * it, preview the decision live, then submit it to Raho.
 */
import { ASSETS, KNOWN_TARGETS } from "../lib/raho/demo-data.ts";
import type { Action, RahoAdapter, TxRequest } from "../lib/raho/index.ts";
import { chip } from "../shared/chip.ts";
import { $, esc } from "../shared/dom.ts";
import { describe } from "../shared/format.ts";
import { openModal, toast } from "./ui.ts";

const FN: Record<Action, string> = { Transfer: "transfer()", Swap: "swap()", Approve: "approve()", Call: "deposit()" };

interface Preset {
  label: string;
  values: Partial<TxRequest>;
}

const PRESETS: Preset[] = [
  { label: "Routine payment", values: { agentId: "payment", action: "Transfer", asset: "USDC", amount: 45, contract: "", recipient: "Approved Wallet" } },
  { label: "Large transfer", values: { agentId: "payment", action: "Transfer", asset: "USDC", amount: 600, contract: "", recipient: "Approved Wallet" } },
  { label: "Unknown contract", values: { agentId: "treasury", action: "Approve", asset: "USDC", amount: 400, contract: "Unknown Router", recipient: "" } },
  { label: "Blocked asset", values: { agentId: "research", action: "Transfer", asset: "TOKEN X", amount: 20, contract: "", recipient: "Data Vendor" } },
];

const options = (list: readonly string[], selected: string, none?: string) =>
  (none !== undefined ? `<option value=""${selected === "" ? " selected" : ""}>${esc(none)}</option>` : "") +
  list.map((v) => `<option value="${esc(v)}"${v === selected ? " selected" : ""}>${esc(v)}</option>`).join("");

export function openSimulator(raho: RahoAdapter, agentId?: string): void {
  const state = raho.getState();
  const first = agentId ?? state.agents.find((a) => a.status === "active")?.id ?? state.agents[0].id;

  const body = `
    <div class="rh-presets" role="group" aria-label="Presets">
      ${PRESETS.map((p, i) => `<button type="button" class="rh-preset rh-preset--sm" data-preset="${i}"><span class="rh-preset__dot" aria-hidden="true"></span>${esc(p.label)}</button>`).join("")}
    </div>
    <div class="rh-form-grid">
      <label class="rh-field"><span class="rh-label">Agent</span>
        <select class="rh-select" name="agentId">${state.agents.map((a) => `<option value="${a.id}"${a.id === first ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>
      <label class="rh-field"><span class="rh-label">Action</span>
        <select class="rh-select" name="action">${options(["Transfer", "Swap", "Approve", "Call"], "Transfer")}</select></label>
      <label class="rh-field"><span class="rh-label">Function</span>
        <input class="rh-input rh-input--mono" name="fn" value="transfer()" maxlength="32" autocomplete="off" /></label>
      <label class="rh-field"><span class="rh-label">Asset</span>
        <select class="rh-select" name="asset">${options(ASSETS, "USDC")}</select></label>
      <label class="rh-field"><span class="rh-label">Amount</span>
        <input class="rh-input rh-input--mono" name="amount" type="number" min="0" step="any" value="50" inputmode="decimal" /></label>
      <label class="rh-field"><span class="rh-label">Contract</span>
        <select class="rh-select" name="contract">${options(KNOWN_TARGETS.contracts, "", "Direct transfer")}</select></label>
      <label class="rh-field"><span class="rh-label">Recipient</span>
        <select class="rh-select" name="recipient">${options(KNOWN_TARGETS.recipients, "Approved Wallet", "None")}</select></label>
      <label class="rh-field rh-field--check" data-unlimited-field hidden><input type="checkbox" name="unlimited" /> <span>Unlimited allowance</span></label>
    </div>
    <div class="rh-sim-result" data-sim-result aria-live="polite"></div>
    <p class="rh-dimension">Evaluated locally · Nothing is signed or sent</p>`;

  openModal({
    kicker: "Simulate request",
    title: "What does the agent want?",
    body,
    confirm: "Send to Raho",
    onOpen(dialog) {
      const form = dialog.querySelector("form")!;
      const field = <T extends HTMLElement>(name: string) => form.elements.namedItem(name) as unknown as T;
      const result = $("[data-sim-result]", dialog)!;
      let fnTouched = false;

      const read = (): TxRequest => {
        const action = field<HTMLSelectElement>("action").value as Action;
        const amount = Math.max(0, Number(field<HTMLInputElement>("amount").value) || 0);
        return {
          agentId: field<HTMLSelectElement>("agentId").value,
          action,
          fn: field<HTMLInputElement>("fn").value.trim() || FN[action],
          asset: field<HTMLSelectElement>("asset").value,
          amount,
          valueUsd: amount,
          contract: field<HTMLSelectElement>("contract").value,
          recipient: field<HTMLSelectElement>("recipient").value,
          unlimited: action === "Approve" && field<HTMLInputElement>("unlimited").checked,
        };
      };

      const update = () => {
        const request = read();
        $<HTMLElement>("[data-unlimited-field]", dialog)!.hidden = request.action !== "Approve";
        const r = raho.previewPolicy(request);
        result.dataset.d = r.decision;
        result.innerHTML = `
          <div class="rh-sim-result__head">${chip(r.decision, r.decision, "rh-chip--lg")}<span class="rh-mono">${esc(r.reason)}</span></div>
          <p>${esc(r.message)}</p>
          <ol class="rh-sim-checks">${r.checks.map((c) => `<li data-r="${c.result}" title="${esc(c.detail)}">${esc(c.label)}</li>`).join("")}</ol>`;
      };

      form.addEventListener("input", (event) => {
        const target = event.target as HTMLElement;
        if (target === field("fn")) fnTouched = true;
        if (target === field("action") && !fnTouched) field<HTMLInputElement>("fn").value = FN[field<HTMLSelectElement>("action").value as Action];
        update();
      });
      form.addEventListener("change", update);

      dialog.querySelector(".rh-presets")!.addEventListener("click", (event) => {
        const b = (event.target as Element).closest<HTMLButtonElement>("[data-preset]");
        if (!b) return;
        const v = PRESETS[Number(b.dataset.preset)].values;
        for (const [k, val] of Object.entries(v)) {
          const el = field<HTMLInputElement>(k);
          if (el) el.value = String(val);
        }
        fnTouched = false;
        field<HTMLInputElement>("fn").value = FN[v.action as Action];
        field<HTMLInputElement>("unlimited").checked = false;
        update();
      });

      update();
      field<HTMLSelectElement>("agentId").focus();

      // Keep a handle for onConfirm.
      (dialog as HTMLDialogElement & { readRequest?: () => TxRequest }).readRequest = read;
    },
    async onConfirm(dialog) {
      const read = (dialog as HTMLDialogElement & { readRequest?: () => TxRequest }).readRequest!;
      const entry = await raho.checkPolicy(read());
      const d = entry.evaluation.decision;
      toast(
        d === "REVIEW"
          ? `${describe(entry.request)} is waiting in Approvals.`
          : `${describe(entry.request)}: ${d}. ${entry.evaluation.message}`,
        d,
      );
    },
  });
}
