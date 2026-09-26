/** Derived values over RahoState. Pure, shared by the engine context and the UI. */
import { sessionState } from "./engine.ts";
import type { ActivityEntry, Decision, EvaluationContext, RahoState, Session } from "./types.ts";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** A request counts as spent once it was allowed, or reviewed and approved. */
export const letThrough = (e: ActivityEntry): boolean =>
  e.evaluation.decision === "ALLOW" || (e.evaluation.decision === "REVIEW" && e.resolution === "approved");

/** The session that governs an agent right now: the newest one it has. */
export function currentSession(state: RahoState, agentId: string): Session | undefined {
  return state.sessions
    .filter((s) => s.agentId === agentId)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
}

export function effectiveSessionStatus(session: Session | undefined, now: number) {
  return sessionState(session, now);
}

export function spentSince(state: RahoState, agentId: string, since: number): number {
  return state.activity
    .filter((e) => e.request.agentId === agentId && e.at > since && letThrough(e))
    .reduce((sum, e) => sum + e.request.valueUsd, 0);
}

export function spentInSession(state: RahoState, sessionId: string): number {
  return state.activity
    .filter((e) => e.sessionId === sessionId && letThrough(e))
    .reduce((sum, e) => sum + e.request.valueUsd, 0);
}

export function contextFor(state: RahoState, agentId: string, now: number): EvaluationContext {
  const session = currentSession(state, agentId);
  return {
    now,
    locked: state.locked,
    agent: state.agents.find((a) => a.id === agentId),
    session,
    spentToday: spentSince(state, agentId, now - DAY),
    spentInSession: session ? spentInSession(state, session.id) : 0,
    requestsThisHour: state.activity.filter((e) => e.request.agentId === agentId && e.at > now - HOUR).length,
  };
}

export const pendingApprovals = (state: RahoState): ActivityEntry[] =>
  state.activity.filter((e) => e.evaluation.decision === "REVIEW" && e.resolution === "pending");

export function decisionCounts(entries: ActivityEntry[]): Record<Decision, number> {
  const counts: Record<Decision, number> = { ALLOW: 0, REVIEW: 0, BLOCK: 0 };
  for (const e of entries) counts[e.evaluation.decision]++;
  return counts;
}

export function activeSessions(state: RahoState, now: number): Session[] {
  return state.agents
    .map((a) => currentSession(state, a.id))
    .filter((s): s is Session => !!s && sessionState(s, now) === "active");
}
