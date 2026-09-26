import { currentSession, DAY, effectiveSessionStatus, spentInSession, spentSince } from "../../lib/raho/selectors.ts";
import { esc } from "../../shared/dom.ts";
import { usd } from "../../shared/format.ts";
import type { View } from "../context.ts";
import { agentChip, countdown, meter, sessionChip } from "../ui.ts";

export const agents: View = {
  title: "Agents",
  kicker: "Who can act",
  render({ state, now }) {
    return `
      <p class="rh-view__lede">Each agent works inside its own policy and session.</p>
      <div class="rh-agent-grid">${state.agents
        .map((agent) => {
          const policy = state.policies[agent.id];
          const session = currentSession(state, agent.id);
          const status = effectiveSessionStatus(session, now);
          const today = spentSince(state, agent.id, now - DAY);
          const used = session ? spentInSession(state, session.id) : 0;
          const allowedAssets = policy.assets.rules.filter((r) => r.decision !== "BLOCK").map((r) => r.label);
          const contracts = policy.contracts.rules.filter((r) => r.decision === "ALLOW").map((r) => r.label);
          const paused = agent.status === "paused";
          return `
          <article class="rh-card rh-agent" data-status="${agent.status}">
            <header class="rh-agent__head">
              <div>
                <h2 class="rh-agent__name">${esc(agent.name)}</h2>
                <p class="rh-agent__purpose">${esc(agent.purpose)}</p>
              </div>
              ${agentChip(agent)}
            </header>
            <dl class="rh-agent__facts">
              <div><dt>Session</dt><dd>${sessionChip(session, now)}${status === "active" ? `<span class="rh-agent__muted">ends in ${countdown(session!.expiresAt)}</span>` : ""}</dd></div>
              <div><dt>Assets</dt><dd class="rh-tags">${allowedAssets.map((a) => `<span class="rh-tag">${esc(a)}</span>`).join("") || "None"}</dd></div>
              <div><dt>Contracts</dt><dd class="rh-tags">${contracts.map((c) => `<span class="rh-tag">${esc(c)}</span>`).join("") || `<span class="rh-agent__muted">Unknown only: ${esc(policy.contracts.fallback.toLowerCase())}</span>`}</dd></div>
              <div><dt>Spent today</dt><dd><span class="rh-mono">${usd(today)} / ${usd(policy.limits.daily)}</span>${meter(today, policy.limits.daily)}</dd></div>
              <div><dt>Session cap</dt><dd><span class="rh-mono">${session ? `${usd(used)} / ${usd(session.maxValue)}` : "None"}</span>${session ? meter(used, session.maxValue) : ""}</dd></div>
              <div><dt>Auto approve</dt><dd class="rh-mono">Up to ${usd(policy.limits.autoApprove)}</dd></div>
            </dl>
            <footer class="rh-agent__actions">
              <button type="button" class="rh-btn rh-btn--sm ${paused ? "" : "rh-btn--ghost"}" data-action="${paused ? "resume-agent" : "pause-agent"}" data-agent="${agent.id}">${paused ? "Resume" : "Pause"}</button>
              ${
                status === "active"
                  ? `<button type="button" class="rh-btn rh-btn--sm rh-btn--ghost" data-action="revoke-session" data-session="${session!.id}">Revoke session</button>`
                  : `<button type="button" class="rh-btn rh-btn--sm rh-btn--ghost" data-action="new-session" data-agent="${agent.id}">New session</button>`
              }
              <a class="rh-btn rh-btn--sm rh-btn--quiet" href="#/policies?agent=${agent.id}">Configure policy</a>
            </footer>
          </article>`;
        })
        .join("")}</div>`;
  },
};
