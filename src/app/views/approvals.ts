import { pendingApprovals } from "../../lib/raho/selectors.ts";
import { chip } from "../../shared/chip.ts";
import { esc } from "../../shared/dom.ts";
import { ago, amount, describe, usd } from "../../shared/format.ts";
import type { View } from "../context.ts";
import { agentName, empty, traceList } from "../ui.ts";

export const approvals: View = {
  title: "Approvals",
  kicker: "Human review",
  render({ state, now }) {
    const pending = pendingApprovals(state);
    const resolved = state.activity.filter((e) => e.resolution === "approved" || e.resolution === "rejected");

    const cards = pending
      .map((e) => {
        const r = e.request;
        const policy = state.policies[r.agentId];
        return `
        <article class="rh-card rh-approval" aria-labelledby="ap-${e.id}">
          <header class="rh-approval__head">
            <span class="rh-kicker">${esc(agentName(state, r.agentId))} · ${ago(e.at, now)}</span>
            ${chip("pending", "Pending")}
          </header>
          <h2 class="rh-approval__title" id="ap-${e.id}">${esc(describe(r))}</h2>
          <p class="rh-approval__reason"><span aria-hidden="true">!</span>${esc(e.evaluation.message.replace(/\.$/, ""))}</p>
          <dl class="rh-kv">
            <div><dt>Action</dt><dd>${esc(r.action)}</dd></div>
            <div><dt>Asset</dt><dd>${esc(amount(r))}</dd></div>
            <div><dt>${r.recipient ? "Recipient" : "Contract"}</dt><dd>${esc(r.recipient || r.contract || "None")}</dd></div>
            ${r.recipient && r.contract ? `<div><dt>Contract</dt><dd>${esc(r.contract)}</dd></div>` : ""}
            <div><dt>Function</dt><dd class="rh-mono">${esc(r.fn)}</dd></div>
            <div><dt>Auto limit</dt><dd class="rh-mono">${usd(policy.limits.autoApprove)}</dd></div>
          </dl>
          <details class="rh-approval__trace">
            <summary>Show policy checks</summary>
            ${traceList(e)}
          </details>
          <div class="rh-approval__actions">
            <button type="button" class="rh-btn" data-action="approve" data-entry="${e.id}">Approve</button>
            <button type="button" class="rh-btn rh-btn--ghost" data-action="reject" data-entry="${e.id}">Reject</button>
          </div>
          <p class="rh-approval__note">Applies to this exact request only.</p>
        </article>`;
      })
      .join("");

    return `
      <p class="rh-view__lede">Requests that need a human. The agent cannot approve its own request.</p>
      ${pending.length ? `<div class="rh-approval-grid">${cards}</div>` : `<section class="rh-card">${empty("Nothing waiting", "Requests that need review will appear here.")}</section>`}
      <section class="rh-card" aria-labelledby="ap-history">
        <div class="rh-card__head"><h2 class="rh-card__title" id="ap-history">Decided</h2><span class="rh-dimension">${resolved.length} resolved</span></div>
        ${
          resolved.length
            ? `<ul class="rh-feed">${resolved
                .map(
                  (e) => `<li class="rh-feed__row">
                    <span class="rh-feed__time rh-mono">${ago(e.resolvedAt ?? e.at, now)}</span>
                    <span class="rh-feed__what"><strong>${esc(describe(e.request))}</strong><span>${esc(agentName(state, e.request.agentId))} · ${esc(e.evaluation.message)}</span></span>
                    ${chip(e.resolution!, e.resolution === "approved" ? "Approved" : "Rejected")}
                  </li>`,
                )
                .join("")}</ul>`
            : empty("No decisions yet", "Approved and rejected requests show here.")
        }
      </section>
      <p class="rh-dimension rh-view__foot">Demo approvals · Nothing is signed or sent</p>`;
  },
};
