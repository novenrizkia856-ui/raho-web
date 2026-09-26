import { contractsReady } from "../../config/index.ts";
import { getWallet } from "../../lib/wallet.ts";
import { activeSessions, currentSession, DAY, decisionCounts, pendingApprovals } from "../../lib/raho/selectors.ts";
import { chip } from "../../shared/chip.ts";
import { esc } from "../../shared/dom.ts";
import { ago, describe, target, usd } from "../../shared/format.ts";
import { shortAddress } from "../../config/index.ts";
import type { View } from "../context.ts";
import { agentName, countdown, empty } from "../ui.ts";

export const overview: View = {
  title: "Overview",
  kicker: "Firewall",
  render({ state, now }) {
    const day = state.activity.filter((e) => e.at > now - DAY);
    const counts = decisionCounts(day);
    const total = day.length || 1;
    const pending = pendingApprovals(state);
    const live = activeSessions(state, now);
    const activeAgents = state.agents.filter((a) => a.status === "active").length;
    const wallet = getWallet();
    const locked = state.locked;

    const kpi = (label: string, value: string | number, note: string, tone = "") =>
      `<div class="rh-kpi" ${tone ? `data-tone="${tone}"` : ""}><span class="rh-dimension">${esc(label)}</span><strong class="rh-kpi__value">${esc(value)}</strong><span class="rh-kpi__note">${note}</span></div>`;

    const recent = state.activity.slice(0, 6);

    return `
      <section class="rh-status-panel" data-level="${locked ? "locked" : "armed"}" aria-label="Firewall status">
        <div class="rh-status-panel__main">
          <span class="rh-dimension">Firewall status</span>
          <strong class="rh-status-panel__value">${locked ? "Locked" : "Armed"}</strong>
          <span class="rh-status-panel__note">${locked ? "Emergency lock blocks every request." : "Every request is checked before signing."}</span>
          <span class="rh-status-panel__scan" aria-hidden="true"></span>
        </div>
        <dl class="rh-status-panel__facts">
          <div><dt>Connected wallet</dt><dd>${wallet.status === "connected" ? `<span class="rh-mono">${esc(shortAddress(wallet.address))}</span>` : "Not connected"}</dd></div>
          <div><dt>Policy engine</dt><dd>${contractsReady() ? "Onchain" : "Local demo"}</dd></div>
          <div><dt>Contracts</dt><dd>${contractsReady() ? "Live" : "Not deployed"}</dd></div>
        </dl>
      </section>

      <section class="rh-kpis" aria-label="Last 24 hours">
        ${kpi("Active agents", `${activeAgents}/${state.agents.length}`, `${state.agents.length - activeAgents} paused`)}
        ${kpi("Requests", day.length, "Last 24 hours")}
        ${kpi("Allowed", counts.ALLOW, `${Math.round((counts.ALLOW / total) * 100)}% of requests`, "allow")}
        ${kpi("In review", pending.length, `${counts.REVIEW} sent to review`, "review")}
        ${kpi("Blocked", counts.BLOCK, `${Math.round((counts.BLOCK / total) * 100)}% of requests`, "block")}
        ${kpi("Live sessions", live.length, live.length ? `Next ends in ${countdown(Math.min(...live.map((s) => s.expiresAt)))}` : "None active")}
      </section>

      <section class="rh-card rh-mix" aria-label="Decision mix">
        <div class="rh-card__head"><h2 class="rh-card__title">Decision mix</h2><span class="rh-dimension">Last 24 hours</span></div>
        <div class="rh-mix__bar" role="img" aria-label="${counts.ALLOW} allowed, ${counts.REVIEW} reviewed, ${counts.BLOCK} blocked">
          ${(["ALLOW", "REVIEW", "BLOCK"] as const)
            .map((d) => (counts[d] ? `<span data-d="${d}" style="flex:${counts[d]}"></span>` : ""))
            .join("")}
        </div>
        <div class="rh-mix__legend">
          ${(["ALLOW", "REVIEW", "BLOCK"] as const).map((d) => `${chip(d)}<span class="rh-mono">${counts[d]}</span>`).join("")}
        </div>
      </section>

      <div class="rh-cols">
        <section class="rh-card" aria-labelledby="ov-activity">
          <div class="rh-card__head"><h2 class="rh-card__title" id="ov-activity">Recent activity</h2><a class="rh-link" href="#/activity">All activity →</a></div>
          ${
            recent.length
              ? `<ul class="rh-feed">${recent
                  .map(
                    (e) => `<li class="rh-feed__row">
                      <span class="rh-feed__time rh-mono">${ago(e.at, now)}</span>
                      <span class="rh-feed__what"><strong>${esc(describe(e.request))}</strong><span>${esc(agentName(state, e.request.agentId))} · ${esc(target(e.request))}</span></span>
                      ${chip(e.evaluation.decision)}
                    </li>`,
                  )
                  .join("")}</ul>`
              : empty("No requests yet", "Simulate one to see a decision.")
          }
        </section>

        <div class="rh-stack">
          <section class="rh-card" aria-labelledby="ov-review">
            <div class="rh-card__head"><h2 class="rh-card__title" id="ov-review">Waiting for you</h2><a class="rh-link" href="#/approvals">Approvals →</a></div>
            ${
              pending.length
                ? `<ul class="rh-mini-list">${pending
                    .slice(0, 3)
                    .map(
                      (e) => `<li>
                        <span><strong>${esc(describe(e.request))}</strong><span>${esc(e.evaluation.message)}</span></span>
                        <span class="rh-mini-list__actions">
                          <button type="button" class="rh-btn rh-btn--sm" data-action="approve" data-entry="${e.id}">Approve</button>
                          <button type="button" class="rh-btn rh-btn--sm rh-btn--ghost" data-action="reject" data-entry="${e.id}">Reject</button>
                        </span>
                      </li>`,
                    )
                    .join("")}</ul>`
                : empty("Nothing to review", "Risky requests will wait here.")
            }
          </section>
          <section class="rh-card" aria-labelledby="ov-sessions">
            <div class="rh-card__head"><h2 class="rh-card__title" id="ov-sessions">Sessions</h2><a class="rh-link" href="#/sessions">Manage →</a></div>
            <ul class="rh-mini-list">${state.agents
              .map((a) => {
                const s = currentSession(state, a.id);
                const live = s && s.status === "active" && s.expiresAt > now;
                return `<li><span><strong>${esc(a.name)}</strong><span>${live ? `Ends in ${countdown(s!.expiresAt)} · ${usd(s!.maxValue)} cap` : "No live session"}</span></span>${chip(live ? "active" : s?.status === "revoked" ? "revoked" : "expired", live ? "Active" : s?.status === "revoked" ? "Revoked" : "Expired")}</li>`;
              })
              .join("")}</ul>
          </section>
        </div>
      </div>`;
  },
};
