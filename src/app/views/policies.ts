/**
 * Policy editor. Edits save to the adapter as they happen. The view repaints
 * itself and restores focus, so keyboard editing never loses its place.
 */
import { normalize } from "../../lib/raho/engine.ts";
import type { Decision, Policy, RuleSet } from "../../lib/raho/types.ts";
import { DECISIONS } from "../../lib/raho/types.ts";
import { $, esc } from "../../shared/dom.ts";
import { ago, titleCase, usd } from "../../shared/format.ts";
import type { AppContext, View } from "../context.ts";
import { confirmAction, toast } from "../ui.ts";

type Dim = "assets" | "contracts" | "functions" | "recipients";

const DIMS: Record<Dim, { title: string; hint: string; fallback: string; placeholder: string }> = {
  assets: { title: "Assets", hint: "What it can move", fallback: "Unknown assets", placeholder: "Add asset, e.g. DAI" },
  contracts: { title: "Contracts", hint: "Where it can interact", fallback: "Unknown contracts", placeholder: "Add contract name" },
  functions: { title: "Functions", hint: "How it can interact", fallback: "Unknown functions", placeholder: "Add function, e.g. deposit()" },
  recipients: { title: "Recipients", hint: "Who can receive", fallback: "Unknown recipients", placeholder: "Add recipient name" },
};

const LIMITS: { key: keyof Policy["limits"]; label: string; unit: string }[] = [
  { key: "autoApprove", label: "Auto approve up to", unit: "$" },
  { key: "perTransaction", label: "Per transaction max", unit: "$" },
  { key: "daily", label: "Daily max", unit: "$" },
  { key: "perHour", label: "Requests per hour", unit: "#" },
];

const SESSION_HOURS = [1, 2, 4, 8, 12, 24];

const seg = (dim: string, rule: string, current: Decision, label: string) =>
  `<div class="rh-seg rh-seg--sm" role="group" aria-label="Decision for ${esc(label)}">${DECISIONS.map(
    (d) =>
      `<button type="button" data-d="${d}" data-dim="${dim}" data-rule="${esc(rule)}" aria-pressed="${d === current}">${titleCase(d)}</button>`,
  ).join("")}</div>`;

function ruleCard(dim: Dim, set: RuleSet): string {
  const meta = DIMS[dim];
  return `
    <section class="rh-card rh-policy-card" aria-labelledby="pc-${dim}">
      <div class="rh-card__head"><h2 class="rh-card__title" id="pc-${dim}">${meta.title}</h2><span class="rh-dimension">${meta.hint}</span></div>
      <ul class="rh-rules">
        ${set.rules
          .map(
            (r) => `<li class="rh-rule">
              <span class="rh-rule__label${dim === "functions" ? " rh-mono" : ""}">${esc(r.label)}</span>
              ${seg(dim, r.id, r.decision, r.label)}
              <button type="button" class="rh-icon-btn rh-rule__remove" data-remove data-dim="${dim}" data-rule="${r.id}" aria-label="Remove ${esc(r.label)}">
                <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" stroke-width="1.6"/></svg>
              </button>
            </li>`,
          )
          .join("")}
        <li class="rh-rule rh-rule--fallback">
          <span class="rh-rule__label">${meta.fallback}</span>
          ${seg(dim, "*", set.fallback, meta.fallback)}
          <span class="rh-rule__spacer" aria-hidden="true"></span>
        </li>
      </ul>
      <form class="rh-rule-add" data-add="${dim}">
        <input class="rh-input" name="label" maxlength="40" autocomplete="off" placeholder="${esc(meta.placeholder)}" aria-label="${esc(meta.placeholder)}" />
        <button type="submit" class="rh-btn rh-btn--sm rh-btn--quiet">Add</button>
      </form>
    </section>`;
}

function summary(policy: Policy): string {
  const all = [policy.assets, policy.contracts, policy.functions, policy.recipients].flatMap((s) => s.rules);
  const count = (d: Decision) => all.filter((r) => r.decision === d).length;
  return `
    <aside class="rh-card rh-policy-summary" aria-label="Policy summary">
      <span class="rh-dimension">Summary</span>
      <ul class="rh-summary">
        <li><span class="rh-chip" data-d="ALLOW">Allow</span><strong class="rh-mono">${count("ALLOW")}</strong></li>
        <li><span class="rh-chip" data-d="REVIEW">Review</span><strong class="rh-mono">${count("REVIEW")}</strong></li>
        <li><span class="rh-chip" data-d="BLOCK">Block</span><strong class="rh-mono">${count("BLOCK")}</strong></li>
      </ul>
      <dl class="rh-summary__facts">
        <div><dt>Auto approve</dt><dd>${usd(policy.limits.autoApprove)}</dd></div>
        <div><dt>Daily cap</dt><dd>${usd(policy.limits.daily)}</dd></div>
        <div><dt>Session</dt><dd>${policy.sessionHours}h</dd></div>
      </dl>
      <p class="rh-policy-saved" data-saved>Saved locally · ${ago(policy.updatedAt)}</p>
      <button type="button" class="rh-btn rh-btn--sm" data-action="simulate" data-agent="${policy.agentId}">Test a request</button>
      <button type="button" class="rh-link rh-policy-reset" data-reset-policy>Reset to defaults</button>
    </aside>`;
}

function selectedAgent(ctx: AppContext): string {
  const id = ctx.params.get("agent");
  return id && ctx.state.policies[id] ? id : ctx.state.agents[0].id;
}

export const policies: View = {
  title: "Policies",
  kicker: "Your rules",
  render(ctx) {
    const agentId = selectedAgent(ctx);
    const policy = ctx.state.policies[agentId];
    return `
      <div class="rh-agent-tabs" role="tablist" aria-label="Agent">
        ${ctx.state.agents
          .map(
            (a) =>
              `<a role="tab" class="rh-agent-tab" href="#/policies?agent=${a.id}" aria-selected="${a.id === agentId}"${a.id === agentId ? ' aria-current="page"' : ""}>${esc(a.name)}</a>`,
          )
          .join("")}
      </div>
      <div class="rh-policy-layout" data-policy="${agentId}">
        <div class="rh-policy-grid">
          ${(Object.keys(DIMS) as Dim[]).map((d) => ruleCard(d, policy[d])).join("")}
          <section class="rh-card rh-policy-card" aria-labelledby="pc-limits">
            <div class="rh-card__head"><h2 class="rh-card__title" id="pc-limits">Limits</h2><span class="rh-dimension">How much</span></div>
            <div class="rh-limits-form">
              ${LIMITS.map(
                (l) => `<label class="rh-field">
                  <span class="rh-label">${l.label}</span>
                  <span class="rh-input-unit" data-unit="${l.unit}"><input class="rh-input rh-input--mono" type="number" min="0" step="1" inputmode="numeric" data-limit="${l.key}" value="${policy.limits[l.key]}" /></span>
                </label>`,
              ).join("")}
            </div>
            <p class="rh-card__note">Above auto approve goes to review. Above a max is blocked.</p>
          </section>
          <section class="rh-card rh-policy-card" aria-labelledby="pc-approval">
            <div class="rh-card__head"><h2 class="rh-card__title" id="pc-approval">Sessions and approval</h2><span class="rh-dimension">When and who</span></div>
            <label class="rh-field">
              <span class="rh-label">Default session length</span>
              <select class="rh-select" data-session-hours>
                ${SESSION_HOURS.map((h) => `<option value="${h}"${h === policy.sessionHours ? " selected" : ""}>${h} ${h === 1 ? "hour" : "hours"}</option>`).join("")}
              </select>
            </label>
            <div class="rh-switch-row">
              <span><strong>Token approvals need review</strong><span>approve() and permit() wait for you.</span></span>
              <button type="button" class="rh-switch" role="switch" aria-checked="${policy.approvals.reviewTokenApprovals}" data-approval="reviewTokenApprovals" aria-label="Token approvals need review"></button>
            </div>
            <div class="rh-switch-row">
              <span><strong>Refuse unlimited approvals</strong><span>Unlimited allowances are blocked outright.</span></span>
              <button type="button" class="rh-switch" role="switch" aria-checked="${policy.approvals.blockUnlimitedApprovals}" data-approval="blockUnlimitedApprovals" aria-label="Refuse unlimited approvals"></button>
            </div>
          </section>
        </div>
        ${summary(policy)}
      </div>`;
  },

  bind(root, ctx) {
    const agentId = selectedAgent(ctx);
    const draft = (): Policy => structuredClone(ctx.raho.getState().policies[agentId]);

    const repaint = (focus?: string) => {
      const y = window.scrollY;
      root.innerHTML = policies.render({ ...ctx, state: ctx.raho.getState() });
      window.scrollTo({ top: y });
      if (focus) $<HTMLElement>(focus, root)?.focus({ preventScroll: true });
    };

    const save = async (policy: Policy, focus?: string, repaintView = true) => {
      await ctx.quietly(() => ctx.raho.updatePolicy(policy));
      if (repaintView) repaint(focus);
      else {
        const saved = $("[data-saved]", root);
        if (saved) saved.textContent = "Saved locally · just now";
      }
    };

    root.addEventListener("click", async (event) => {
      const el = event.target as HTMLElement;

      const segBtn = el.closest<HTMLButtonElement>(".rh-seg button[data-dim]");
      if (segBtn) {
        const p = draft();
        const set = p[segBtn.dataset.dim as Dim];
        const d = segBtn.dataset.d as Decision;
        if (segBtn.dataset.rule === "*") set.fallback = d;
        else {
          const rule = set.rules.find((r) => r.id === segBtn.dataset.rule);
          if (rule) rule.decision = d;
        }
        return save(p, `.rh-seg button[data-dim="${segBtn.dataset.dim}"][data-rule="${segBtn.dataset.rule}"][data-d="${d}"]`);
      }

      const remove = el.closest<HTMLButtonElement>("[data-remove]");
      if (remove) {
        const p = draft();
        const dim = remove.dataset.dim as Dim;
        const rule = p[dim].rules.find((r) => r.id === remove.dataset.rule);
        p[dim].rules = p[dim].rules.filter((r) => r.id !== remove.dataset.rule);
        await save(p, `[data-add="${dim}"] input`);
        return toast(`${rule?.label ?? "Rule"} removed. Unknown rule applies.`);
      }

      const sw = el.closest<HTMLButtonElement>("[data-approval]");
      if (sw) {
        const p = draft();
        const key = sw.dataset.approval as keyof Policy["approvals"];
        p.approvals[key] = !p.approvals[key];
        return save(p, `[data-approval="${key}"]`);
      }

      if (el.closest("[data-reset-policy]")) {
        const name = ctx.state.agents.find((a) => a.id === agentId)?.name ?? "this agent";
        confirmAction({
          kicker: "Reset policy",
          title: `Reset ${name} to defaults?`,
          body: `<p class="rh-modal__text">USDC only, unknown contracts reviewed, $100 per transaction.</p>`,
          confirm: "Reset policy",
          danger: true,
          onConfirm: async () => {
            await ctx.quietly(async () => void (await ctx.raho.createPolicy(agentId)));
            repaint();
            toast("Policy reset to defaults.");
          },
        });
      }
    });

    root.addEventListener("submit", (event) => {
      const form = (event.target as HTMLElement).closest<HTMLFormElement>("[data-add]");
      if (!form) return;
      event.preventDefault();
      const dim = form.dataset.add as Dim;
      const input = form.elements.namedItem("label") as HTMLInputElement;
      let label = input.value.trim().replace(/\s+/g, " ");
      if (!label) return input.focus();
      if (dim === "functions" && !label.endsWith(")")) label = `${label.replace(/\($/, "")}()`;
      if (dim === "assets") label = label.toUpperCase();
      const p = draft();
      if (p[dim].rules.some((r) => normalize(r.label) === normalize(label))) {
        toast(`${label} is already listed.`);
        return input.select();
      }
      p[dim].rules.push({ id: `r${Date.now().toString(36)}`, label, decision: "REVIEW" });
      void save(p, `[data-add="${dim}"] input`);
      toast(`${label} added as Review. Change it any time.`);
    });

    root.addEventListener("change", (event) => {
      const el = event.target as HTMLInputElement | HTMLSelectElement;
      if (el.matches("[data-limit]")) {
        const p = draft();
        const value = Math.max(0, Math.floor(Number(el.value) || 0));
        el.value = String(value);
        p.limits[el.dataset.limit as keyof Policy["limits"]] = value;
        void save(p, undefined, false);
      } else if (el.matches("[data-session-hours]")) {
        const p = draft();
        p.sessionHours = Number(el.value);
        void save(p, undefined, false);
      }
    });
  },
};
