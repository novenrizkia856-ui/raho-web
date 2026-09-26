/**
 * Transaction preview as three tiers, one per decision, laid out like the
 * reference offer section. Every value comes from the real engine.
 */
import type { Decision } from "../lib/raho/types.ts";
import { $, esc } from "../shared/dom.ts";
import { describe } from "../shared/format.ts";
import { PREVIEW_SAMPLES, run } from "./examples.ts";

const TIER: Record<Decision, { panel: string; card: string; kicker: string; outcome: string; target: string }> = {
  ALLOW: { panel: "rh-panel--cyan", card: "cyan", kicker: "rh-kicker--cyan", outcome: "Passed to the signer", target: "To Approved Wallet" },
  REVIEW: { panel: "rh-panel--amber", card: "amber", kicker: "", outcome: "Waits for your approval", target: "To Approved Wallet" },
  BLOCK: { panel: "rh-panel--limit", card: "limit", kicker: "rh-kicker--limit", outcome: "Nothing is signed", target: "Spender Unknown Router" },
};

export function initPreview(): void {
  const root = $("[data-decisions]");
  if (!root) return;
  root.innerHTML = (["ALLOW", "REVIEW", "BLOCK"] as const)
    .map((d) => {
      const sample = PREVIEW_SAMPLES[d];
      const result = run(sample.request);
      const t = TIER[d];
      const passed = result.checks.filter((c) => c.result === "pass").length;
      return `
      <article class="rh-panel ${t.panel}" data-card="${t.card}">
        <div class="rh-tier" data-d="${result.decision}">
          <div class="rh-kicker ${t.kicker}">${result.decision} · ${esc(sample.agent)}</div>
          <h3 class="rh-subhead">${esc(describe(sample.request))}</h3>
          <p class="rh-caption">${esc(t.target)}. ${esc(result.message)}</p>
          <ol class="rh-tier__checks" aria-label="${passed} of ${result.checks.length} checks passed">
            ${result.checks.map((c) => `<li data-r="${c.result}" title="${esc(`${c.label}: ${c.result === "skip" ? "not reached" : c.detail}`)}"></li>`).join("")}
          </ol>
          <div class="rh-tier__foot">
            <p class="rh-dimension">${esc(result.reason)} · ${passed} of ${result.checks.length} checks passed</p>
            <span class="rh-tier__outcome">${esc(t.outcome)}</span>
          </div>
        </div>
      </article>`;
    })
    .join("");
}
