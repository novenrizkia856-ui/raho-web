import { currentSession, effectiveSessionStatus } from "../../lib/raho/selectors.ts";
import { chip } from "../../shared/chip.ts";
import { esc } from "../../shared/dom.ts";
import { usd } from "../../shared/format.ts";
import type { View } from "../context.ts";

export const controls: View = {
  title: "Emergency controls",
  kicker: "Containment",
  render({ state, now }) {
    const locked = state.locked;
    const rows = state.agents
      .map((agent) => {
        const session = currentSession(state, agent.id);
        const live = effectiveSessionStatus(session, now) === "active";
        const paused = agent.status === "paused";
        const limits = state.policies[agent.id].limits;
        return `<tr>
          <th scope="row">${esc(agent.name)}</th>
          <td>${chip(paused ? "paused" : "active")}</td>
          <td>${live ? chip("active", "Live") : chip(session?.status === "revoked" ? "revoked" : "expired", session?.status === "revoked" ? "Revoked" : "None live")}</td>
          <td class="rh-mono">${usd(limits.perTransaction)} · ${usd(limits.daily)}/day</td>
          <td class="rh-controls-table__actions">
            <button type="button" class="rh-btn rh-btn--sm ${paused ? "" : "rh-btn--ghost"}" data-action="${paused ? "resume-agent" : "pause-agent"}" data-agent="${agent.id}">${paused ? "Resume" : "Pause"}</button>
            <button type="button" class="rh-btn rh-btn--sm rh-btn--ghost" data-action="revoke-session" data-session="${session?.id ?? ""}" ${live ? "" : "disabled"}>Revoke</button>
            <button type="button" class="rh-btn rh-btn--sm rh-btn--quiet" data-action="reset-limits" data-agent="${agent.id}">Reset limits</button>
          </td>
        </tr>`;
      })
      .join("");

    return `
      <p class="rh-view__lede">These act on the firewall, not the agent. The agent cannot undo them.</p>
      <section class="rh-lock-panel" data-locked="${locked}" aria-labelledby="ct-lock">
        <div class="rh-lock-panel__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30"><rect x="5" y="10.5" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10.5V8a4 4 0 0 1 ${locked ? "8 0v2.5" : "7.6-1.6"}" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
        </div>
        <div class="rh-lock-panel__text">
          <span class="rh-kicker rh-kicker--limit">Emergency lock</span>
          <h2 class="rh-subhead" id="ct-lock">${locked ? "Every agent is blocked." : "Stop every agent at once."}</h2>
          <p class="rh-caption">${locked ? "New requests return BLOCK until you release it." : "Overrides every allow rule, session and approval path."}</p>
        </div>
        <button type="button" class="rh-btn ${locked ? "rh-btn--ghost" : "rh-btn--danger"}" data-action="${locked ? "unlock" : "lock"}">${locked ? "Release lock" : "Engage lock"}</button>
      </section>

      <section class="rh-card rh-card--flush" aria-labelledby="ct-agents">
        <div class="rh-card__head rh-card__head--pad"><h2 class="rh-card__title" id="ct-agents">Per agent</h2><button type="button" class="rh-link" data-action="reset-limits">Reset all limits</button></div>
        <div class="rh-table-scroll">
          <table class="rh-table rh-table--app rh-controls-table">
            <thead><tr><th scope="col">Agent</th><th scope="col">Agent status</th><th scope="col">Session</th><th scope="col">Limits</th><th scope="col"><span class="rh-sr">Actions</span></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>

      <div class="rh-control-notes">
        <div class="rh-point"><h3 class="rh-card-head">Pause</h3><p class="rh-caption">Stops new requests from one agent.</p></div>
        <div class="rh-point"><h3 class="rh-card-head">Revoke</h3><p class="rh-caption">Ends the session. A new one is needed to act.</p></div>
        <div class="rh-point"><h3 class="rh-card-head">Reset limits</h3><p class="rh-caption">Restores $50 auto, $100 per request, $250 daily.</p></div>
      </div>`;
  },
};
