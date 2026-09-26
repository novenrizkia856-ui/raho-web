import { currentSession, effectiveSessionStatus, spentInSession } from "../../lib/raho/selectors.ts";
import { chip } from "../../shared/chip.ts";
import { esc } from "../../shared/dom.ts";
import { time, usd } from "../../shared/format.ts";
import type { View } from "../context.ts";
import { agentName, countdown, meter } from "../ui.ts";

export const sessions: View = {
  title: "Sessions",
  kicker: "Temporary authority",
  render({ state, now }) {
    const live = state.agents.map((agent) => {
      const s = currentSession(state, agent.id);
      const status = effectiveSessionStatus(s, now);
      const used = s ? spentInSession(state, s.id) : 0;
      const pct = s && status === "active" ? Math.max(0, (s.expiresAt - now) / (s.expiresAt - s.startedAt)) : 0;
      return `
        <article class="rh-card rh-session-row" data-status="${status}">
          <div class="rh-session-row__ring" style="--p:${(pct * 100).toFixed(1)}" data-ring-start="${s?.startedAt ?? 0}" data-ring-end="${status === "active" ? s!.expiresAt : 0}" aria-hidden="true"></div>
          <div class="rh-session-row__who">
            <h2 class="rh-agent__name">${esc(agent.name)}</h2>
            <span class="rh-mono rh-agent__muted">${s ? esc(s.id) : "No session yet"}</span>
          </div>
          <dl class="rh-session-row__facts">
            <div><dt>Status</dt><dd>${status === "none" ? chip("none", "None") : chip(status)}${agent.status === "paused" ? chip("paused", "Agent paused") : ""}</dd></div>
            <div><dt>Time left</dt><dd class="rh-mono">${status === "active" ? countdown(s!.expiresAt, "clock") : "0:00:00"}</dd></div>
            <div><dt>Assets</dt><dd class="rh-tags">${s ? s.assets.map((a) => `<span class="rh-tag">${esc(a)}</span>`).join("") : "None"}</dd></div>
            <div><dt>Used</dt><dd><span class="rh-mono">${s ? `${usd(used)} / ${usd(s.maxValue)}` : "None"}</span>${s ? meter(used, s.maxValue) : ""}</dd></div>
          </dl>
          <div class="rh-session-row__actions">
            ${
              status === "active"
                ? `<button type="button" class="rh-btn rh-btn--sm rh-btn--ghost" data-action="revoke-session" data-session="${s!.id}">Revoke</button>`
                : ""
            }
            <button type="button" class="rh-btn rh-btn--sm ${status === "active" ? "rh-btn--quiet" : ""}" data-action="new-session" data-agent="${agent.id}">${status === "active" ? "Replace" : "New session"}</button>
          </div>
        </article>`;
    });

    const history = [...state.sessions]
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((s) => {
        const status = effectiveSessionStatus(s, now);
        return `<tr>
          <td class="rh-mono">${esc(s.id)}</td>
          <td>${esc(agentName(state, s.agentId))}</td>
          <td>${esc(s.assets.join(", "))}</td>
          <td class="rh-mono">${usd(s.maxValue)}</td>
          <td class="rh-mono">${time(s.startedAt)}</td>
          <td class="rh-mono">${time(s.expiresAt)}</td>
          <td>${chip(status)}</td>
        </tr>`;
      })
      .join("");

    return `
      <p class="rh-view__lede">Sessions give an agent scoped authority that expires. Only an active session can allow.</p>
      <div class="rh-session-list">${live.join("")}</div>
      <section class="rh-card" aria-labelledby="ss-history">
        <div class="rh-card__head"><h2 class="rh-card__title" id="ss-history">All sessions</h2><span class="rh-dimension">${state.sessions.length} total</span></div>
        <div class="rh-table-scroll">
          <table class="rh-table rh-table--app">
            <thead><tr><th scope="col">Session</th><th scope="col">Agent</th><th scope="col">Assets</th><th scope="col">Cap</th><th scope="col">Started</th><th scope="col">Ends</th><th scope="col">Status</th></tr></thead>
            <tbody>${history}</tbody>
          </table>
        </div>
      </section>`;
  },
};
