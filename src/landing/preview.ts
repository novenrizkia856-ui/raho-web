/** Transaction preview: the request, every check, and the reason for the decision. */
import type { Decision } from "../lib/raho/types.ts";
import { chip } from "../shared/chip.ts";
import { $, $$, esc } from "../shared/dom.ts";
import { amount } from "../shared/format.ts";
import { PREVIEW_SAMPLES, run } from "./examples.ts";

const RESULT_LABEL = { pass: "Pass", review: "Review", block: "Block", skip: "Skipped" } as const;

export function renderPreviewCard(card: HTMLElement, d: Decision): void {
  const sample = PREVIEW_SAMPLES[d];
  const r = sample.request;
  const result = run(r);
  card.dataset.d = result.decision;
  const fields: [string, string][] = [
    ["Agent", sample.agent],
    ["Action", r.action],
    ["Asset", r.asset],
    ["Amount", amount(r)],
    [r.recipient ? "Recipient" : "Contract", r.recipient || r.contract],
    ["Function", r.fn],
  ];
  card.innerHTML = `
    <div class="rh-preview__fields">
      <span class="rh-kicker rh-kicker--muted">Request</span>
      <dl class="rh-kv">${fields.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd${k === "Function" ? ' class="rh-mono"' : ""}>${esc(v)}</dd></div>`).join("")}</dl>
    </div>
    <div class="rh-preview__trace">
      <span class="rh-kicker rh-kicker--muted">Policy checks</span>
      <ol class="rh-trace">${result.checks
        .map(
          (c, i) =>
            `<li data-r="${c.result}" style="--i:${i}"><span class="rh-trace__n">${String(i + 1).padStart(2, "0")}</span><span class="rh-trace__label">${esc(c.label)}</span><span class="rh-trace__detail">${esc(c.result === "skip" ? "" : c.detail)}</span>${chip(c.result, RESULT_LABEL[c.result])}</li>`,
        )
        .join("")}</ol>
    </div>
    <div class="rh-preview__foot">
      ${chip(result.decision, result.decision, "rh-chip--lg")}
      <span class="rh-preview__reason">${esc(result.reason)}</span>
      <span class="rh-preview__message">${esc(result.message)}</span>
    </div>`;
}

export function initPreview(): void {
  const root = $("[data-preview]");
  if (!root) return;
  const card = $("[data-preview-card]", root)!;
  const tabs = $$<HTMLButtonElement>("[data-preview-tabs] button", root);
  const select = (d: Decision) => {
    for (const t of tabs) t.setAttribute("aria-pressed", String(t.dataset.d === d));
    renderPreviewCard(card, d);
  };
  for (const t of tabs) t.addEventListener("click", () => select(t.dataset.d as Decision));
  select("ALLOW");
}
