/** Every data-action button in the app lands here and goes through the adapter. */
import { currentSession } from "../lib/raho/selectors.ts";
import type { RahoAdapter } from "../lib/raho/index.ts";
import { DemoAdapter } from "../lib/raho/demo-adapter.ts";
import { connectWallet, disconnectWallet } from "../lib/wallet.ts";
import { esc } from "../shared/dom.ts";
import { describe } from "../shared/format.ts";
import { openSimulator } from "./simulate.ts";
import { confirmAction, openModal, toast } from "./ui.ts";

const name = (raho: RahoAdapter, agentId: string) => raho.getState().agents.find((a) => a.id === agentId)?.name ?? "Agent";

function openNewSession(raho: RahoAdapter, agentId: string): void {
  const state = raho.getState();
  const policy = state.policies[agentId];
  const assets = policy.assets.rules.filter((r) => r.decision !== "BLOCK").map((r) => r.label);
  const previous = currentSession(state, agentId);
  const cap = previous?.maxValue ?? policy.limits.daily;
  openModal({
    kicker: "New session",
    title: `Open a session for ${name(raho, agentId)}`,
    body: `
      <fieldset class="rh-fieldset">
        <legend class="rh-label">Assets in scope</legend>
        <div class="rh-checks">${
          assets.length
            ? assets.map((a) => `<label class="rh-check"><input type="checkbox" name="asset" value="${esc(a)}" checked /> <span>${esc(a)}</span></label>`).join("")
            : '<span class="rh-agent__muted">This policy allows no assets.</span>'
        }</div>
      </fieldset>
      <div class="rh-form-grid">
        <label class="rh-field"><span class="rh-label">Spending ceiling ($)</span><input class="rh-input rh-input--mono" name="max" type="number" min="1" step="1" value="${cap}" required /></label>
        <label class="rh-field"><span class="rh-label">Expires after</span>
          <select class="rh-select" name="hours">${[1, 2, 4, 8, 12, 24].map((h) => `<option value="${h}"${h === policy.sessionHours ? " selected" : ""}>${h} ${h === 1 ? "hour" : "hours"}</option>`).join("")}</select></label>
      </div>
      ${previous && previous.status === "active" && previous.expiresAt > Date.now() ? '<p class="rh-modal__text">The current session ends when this one starts.</p>' : ""}
      <p class="rh-form-error" data-error role="alert"></p>`,
    confirm: "Open session",
    async onConfirm(dialog) {
      const form = dialog.querySelector("form")!;
      const picked = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="asset"]:checked')).map((i) => i.value);
      const max = Number((form.elements.namedItem("max") as HTMLInputElement).value);
      const error = dialog.querySelector<HTMLElement>("[data-error]")!;
      if (!picked.length) return ((error.textContent = "Pick at least one asset."), false);
      if (!(max > 0)) return ((error.textContent = "Set a ceiling above zero."), false);
      const hours = Number((form.elements.namedItem("hours") as HTMLSelectElement).value);
      await raho.createSession(agentId, { assets: picked, maxValue: max, hours });
      toast(`Session open for ${name(raho, agentId)}. Ends in ${hours}h.`, "ALLOW");
    },
  });
}

export async function handleAction(raho: RahoAdapter, el: HTMLElement, navigate: (path: string) => void): Promise<void> {
  const { action, agent = "", session = "", entry = "" } = el.dataset;
  const state = raho.getState();
  switch (action) {
    case "simulate":
      return openSimulator(raho, agent || undefined);
    case "pause-agent":
      await raho.pauseAgent(agent);
      return toast(`${name(raho, agent)} paused. New requests are blocked.`, "BLOCK");
    case "resume-agent":
      await raho.resumeAgent(agent);
      return toast(`${name(raho, agent)} resumed.`, "ALLOW");
    case "revoke-session": {
      const s = state.sessions.find((x) => x.id === session);
      if (!s) return;
      await raho.revokeSession(session);
      return toast(`${name(raho, s.agentId)} session revoked.`, "BLOCK");
    }
    case "new-session":
      return openNewSession(raho, agent);
    case "approve":
    case "reject": {
      const e = state.activity.find((x) => x.id === entry);
      if (!e) return;
      await (action === "approve" ? raho.approveRequest(entry) : raho.rejectRequest(entry));
      return toast(
        action === "approve" ? `Approved: ${describe(e.request)}. This request only.` : `Rejected: ${describe(e.request)}. Nothing signed.`,
        action === "approve" ? "ALLOW" : "BLOCK",
      );
    }
    case "lock":
      confirmAction({
        kicker: "Emergency lock",
        title: "Block every agent now?",
        body: '<p class="rh-modal__text">All new requests will return BLOCK until you release the lock.</p>',
        confirm: "Engage lock",
        danger: true,
        onConfirm: async () => {
          await raho.setEmergencyLock(true);
          toast("Emergency lock engaged.", "BLOCK");
        },
      });
      return;
    case "unlock":
      await raho.setEmergencyLock(false);
      return toast("Lock released. Policies apply again.", "ALLOW");
    case "reset-limits":
      confirmAction({
        kicker: "Reset limits",
        title: agent ? `Reset limits for ${name(raho, agent)}?` : "Reset limits for every agent?",
        body: '<p class="rh-modal__text">Restores $50 auto approve, $100 per request and $250 per day.</p>',
        confirm: "Reset limits",
        onConfirm: async () => {
          await raho.resetLimits(agent || undefined);
          toast("Conservative limits restored.");
        },
      });
      return;
    case "reset-demo":
      confirmAction({
        kicker: "Demo data",
        title: "Start the demo again?",
        body: '<p class="rh-modal__text">Your policy edits, sessions and history in this browser will be replaced.</p>',
        confirm: "Reset demo",
        danger: true,
        onConfirm: () => {
          if (raho instanceof DemoAdapter) raho.reset();
          toast("Demo data restored.");
          navigate("/overview");
        },
      });
      return;
    case "connect-wallet": {
      const w = await connectWallet();
      if (w.status === "connected") toast("Wallet connected. Read only.", "ALLOW");
      else if (w.error) toast(w.error);
      return;
    }
    case "disconnect-wallet":
      disconnectWallet();
      return toast("Account forgotten on this page.");
  }
}
