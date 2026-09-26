/** Small local demos: human review, a live session, and the emergency controls. */
import { $, $$ } from "../shared/dom.ts";
import { clock } from "../shared/format.ts";

export function initReviewDemo(): void {
  const card = $("[data-review-card]");
  if (!card) return;
  const actions = $("[data-review-actions]", card)!;
  const result = $("[data-review-result]", card)!;
  const outcome = $("[data-review-outcome]", card)!;
  const chipEl = $("[data-review-chip]", card)!;

  const set = (state: "pending" | "approved" | "rejected") => {
    card.dataset.state = state;
    chipEl.dataset.d = state;
    chipEl.textContent = state === "pending" ? "Pending" : state === "approved" ? "Approved" : "Rejected";
    actions.hidden = state !== "pending";
    result.hidden = state === "pending";
    outcome.textContent =
      state === "approved" ? "Approved. This one request may proceed." : state === "rejected" ? "Rejected. Nothing was signed." : "";
    if (state === "pending") $<HTMLButtonElement>('[data-review="approve"]', card)?.focus({ preventScroll: true });
    else $<HTMLButtonElement>('[data-review="reset"]', card)?.focus({ preventScroll: true });
  };

  card.addEventListener("click", (event) => {
    const action = (event.target as Element).closest<HTMLElement>("[data-review]")?.dataset.review;
    if (action === "approve") set("approved");
    else if (action === "reject") set("rejected");
    else if (action === "reset") set("pending");
  });
}

export function initSessionDemo(): void {
  const card = $("[data-session-card]");
  if (!card) return;
  const LENGTH = 2 * 3_600_000;
  const clockEl = $("[data-session-clock]", card)!;
  const bar = $("[data-session-bar]", card)!;
  const chipEl = $("[data-session-chip]", card)!;
  const rule = $("[data-session-rule]", card)!;
  const toggle = $<HTMLButtonElement>("[data-session-toggle]", card)!;

  let expiresAt = Date.now() + LENGTH - 18_000;
  let revoked = false;

  const tick = () => {
    const left = revoked ? 0 : Math.max(0, expiresAt - Date.now());
    clockEl.textContent = revoked ? "Revoked" : clock(left);
    bar.style.transform = `scaleX(${left / LENGTH})`;
  };

  const render = () => {
    card.dataset.state = revoked ? "revoked" : "active";
    chipEl.dataset.d = revoked ? "revoked" : "active";
    chipEl.textContent = revoked ? "Revoked" : "Active";
    rule.textContent = revoked ? "New requests block" : "New requests are checked";
    toggle.textContent = revoked ? "Start new session" : "Revoke session";
    tick();
  };

  toggle.addEventListener("click", () => {
    revoked = !revoked;
    if (!revoked) expiresAt = Date.now() + LENGTH;
    render();
  });

  render();
  setInterval(tick, 1000);
}

export function initEmergencyDemo(): void {
  const status = $("[data-estatus]");
  if (!status) return;
  const value = $("[data-estatus-value]", status)!;
  const detail = $("[data-estatus-detail]", status)!;
  const state = { pause: false, revoke: false, lock: false, resetAt: 0 };
  const buttons = $$<HTMLButtonElement>("[data-emergency]");

  const LABELS: Record<string, [string, string]> = {
    pause: ["Pause agent", "Resume agent"],
    revoke: ["Revoke session", "New session"],
    lock: ["Engage lock", "Release lock"],
  };

  const render = () => {
    const level = state.lock ? "locked" : state.pause || state.revoke ? "warn" : "armed";
    status.dataset.level = level;
    value.textContent = state.lock ? "Locked" : level === "warn" ? "Restricted" : "Armed";
    const parts = [
      state.lock ? "Every agent blocked" : state.pause ? "Research Agent paused" : "Research Agent active",
      state.revoke ? "Session revoked" : "Session live",
      Date.now() - state.resetAt < 4000 ? "Limits restored" : "Limits default",
    ];
    detail.textContent = parts.join(" · ");
    for (const b of buttons) {
      const key = b.dataset.emergency!;
      if (!(key in LABELS)) continue;
      const on = state[key as "pause" | "revoke" | "lock"];
      b.textContent = LABELS[key][on ? 1 : 0];
      b.setAttribute("aria-pressed", String(on));
      b.closest(".rh-ecard")?.classList.toggle("is-engaged", on);
    }
  };

  for (const b of buttons) {
    b.addEventListener("click", () => {
      const key = b.dataset.emergency!;
      if (key === "reset") {
        state.resetAt = Date.now();
        setTimeout(render, 4100);
      } else {
        const k = key as "pause" | "revoke" | "lock";
        state[k] = !state[k];
      }
      render();
    });
  }
  render();
}
