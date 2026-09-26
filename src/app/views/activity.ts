/** Evaluation history with filters. Rows expand to show every check. */
import type { ActivityEntry, Decision, RahoState } from "../../lib/raho/types.ts";
import { chip } from "../../shared/chip.ts";
import { $, $$, esc } from "../../shared/dom.ts";
import { amount, target, time } from "../../shared/format.ts";
import type { AppContext, View } from "../context.ts";
import { agentName, empty, traceList } from "../ui.ts";

interface Filter {
  decision: Decision | "";
  agent: string;
  q: string;
}

// Filters survive re-renders caused by new activity.
const filter: Filter = { decision: "", agent: "", q: "" };

function matches(state: RahoState, e: ActivityEntry): boolean {
  if (filter.decision && e.evaluation.decision !== filter.decision) return false;
  if (filter.agent && e.request.agentId !== filter.agent) return false;
  if (!filter.q) return true;
  const hay = [
    agentName(state, e.request.agentId),
    e.request.action,
    e.request.fn,
    e.request.asset,
    e.request.contract,
    e.request.recipient,
    e.evaluation.reason,
    e.evaluation.decision,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(filter.q.toLowerCase());
}

function resolution(e: ActivityEntry): string {
  if (e.resolution === "approved") return chip("approved", "Approved");
  if (e.resolution === "rejected") return chip("rejected", "Rejected");
  if (e.resolution === "pending") return `<a class="rh-link" href="#/approvals">Pending</a>`;
  return "";
}

function rows(ctx: AppContext): string {
  const { state } = ctx;
  const list = state.activity.filter((e) => matches(state, e));
  if (!list.length) return empty("No matching requests", "Try another filter.");
  return `<ul class="rh-log" role="list">${list
    .map(
      (e) => `<li class="rh-log__item" data-d="${e.evaluation.decision}">
        <button type="button" class="rh-log__row" aria-expanded="false" aria-controls="tr-${e.id}">
          <span class="rh-log__cell rh-log__time rh-mono" data-label="Time">${time(e.at)}</span>
          <span class="rh-log__cell rh-log__agent" data-label="Agent">${esc(agentName(state, e.request.agentId))}</span>
          <span class="rh-log__cell" data-label="Action">${esc(e.request.action)} <span class="rh-mono rh-log__fn">${esc(e.request.fn)}</span></span>
          <span class="rh-log__cell rh-mono" data-label="Asset">${esc(e.request.asset)}</span>
          <span class="rh-log__cell rh-mono rh-log__amount" data-label="Amount">${esc(amount(e.request).replace(` ${e.request.asset}`, ""))}</span>
          <span class="rh-log__cell rh-log__target" data-label="Target">${esc(target(e.request))}</span>
          <span class="rh-log__cell rh-log__decision" data-label="Decision">${chip(e.evaluation.decision)}</span>
        </button>
        <div class="rh-log__detail" id="tr-${e.id}" hidden>
          <div class="rh-log__why">
            <span class="rh-dimension">Why</span>
            <strong>${esc(e.evaluation.message)}</strong>
            <span class="rh-mono rh-log__code">${esc(e.evaluation.reason)}</span>
            ${resolution(e)}
            <span class="rh-log__ref rh-mono">${esc(e.id)}${e.sessionId ? ` · ${esc(e.sessionId)}` : ""}</span>
          </div>
          ${traceList(e)}
        </div>
      </li>`,
    )
    .join("")}</ul>`;
}

export const activity: View = {
  title: "Activity",
  kicker: "Every decision",
  render(ctx) {
    const { state } = ctx;
    const counts = { "": state.activity.length } as Record<string, number>;
    for (const e of state.activity) counts[e.evaluation.decision] = (counts[e.evaluation.decision] ?? 0) + 1;
    return `
      <div class="rh-filters" role="search">
        <div class="rh-seg rh-seg--filter" role="group" aria-label="Decision">
          ${(["", "ALLOW", "REVIEW", "BLOCK"] as const)
            .map(
              (d) =>
                `<button type="button" data-filter-decision="${d}" data-d="${d || "ALL"}" aria-pressed="${filter.decision === d}">${d ? d.charAt(0) + d.slice(1).toLowerCase() : "All"} <span class="rh-mono">${counts[d] ?? 0}</span></button>`,
            )
            .join("")}
        </div>
        <select class="rh-select rh-filters__agent" data-filter-agent aria-label="Agent">
          <option value="">All agents</option>
          ${state.agents.map((a) => `<option value="${a.id}"${filter.agent === a.id ? " selected" : ""}>${esc(a.name)}</option>`).join("")}
        </select>
        <input class="rh-input rh-filters__q" type="search" data-filter-q placeholder="Search asset, target or reason" aria-label="Search activity" value="${esc(filter.q)}" />
      </div>
      <section class="rh-card rh-card--flush" aria-label="Activity log">
        <div class="rh-log__head" aria-hidden="true">
          <span>Time</span><span>Agent</span><span>Action</span><span>Asset</span><span>Amount</span><span>Target</span><span>Decision</span>
        </div>
        <div data-log>${rows(ctx)}</div>
      </section>
      <p class="rh-dimension rh-view__foot">Demo history · Evaluated locally · Nothing was sent onchain</p>`;
  },
  bind(root, ctx) {
    const log = $("[data-log]", root)!;
    const refresh = () => {
      log.innerHTML = rows({ ...ctx, state: ctx.raho.getState() });
    };
    root.addEventListener("click", (event) => {
      const el = event.target as HTMLElement;
      const f = el.closest<HTMLButtonElement>("[data-filter-decision]");
      if (f) {
        filter.decision = f.dataset.filterDecision as Filter["decision"];
        for (const b of $$<HTMLButtonElement>("[data-filter-decision]", root)) b.setAttribute("aria-pressed", String(b === f));
        return refresh();
      }
      const row = el.closest<HTMLButtonElement>(".rh-log__row");
      if (row) {
        const open = row.getAttribute("aria-expanded") === "true";
        row.setAttribute("aria-expanded", String(!open));
        (row.nextElementSibling as HTMLElement).hidden = open;
      }
    });
    $("[data-filter-agent]", root)!.addEventListener("change", (e) => {
      filter.agent = (e.target as HTMLSelectElement).value;
      refresh();
    });
    $("[data-filter-q]", root)!.addEventListener("input", (e) => {
      filter.q = (e.target as HTMLInputElement).value.trim();
      refresh();
    });
  },
};
