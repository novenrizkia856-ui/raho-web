/**
 * Demo adapter: the full Raho behaviour, evaluated locally.
 *
 * Decisions come from the real policy engine. Nothing is signed, sent or
 * written onchain. State lives in memory and, when the browser allows it,
 * in localStorage so a refresh keeps your edits.
 */
import type { ActivityFilter, RahoAdapter, SessionOptions } from "./adapter.ts";
import {
  DEFAULT_LIMITS,
  DEMO_AGENTS,
  DEMO_REQUESTS,
  PAUSED_AFTER_SEED,
  defaultPolicy,
  demoPolicies,
  demoSessions,
} from "./demo-data.ts";
import { evaluate } from "./engine.ts";
import { contextFor, currentSession } from "./selectors.ts";
import type { ActivityEntry, Policy, RahoState, Session, TxRequest } from "./types.ts";

const STORAGE_KEY = "raho.demo.v1";
const STALE_AFTER = 3 * 3_600_000;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36).slice(-4)}${(seq++).toString(36)}`.toUpperCase();

function record(state: RahoState, request: TxRequest, at: number): ActivityEntry {
  const policy = state.policies[request.agentId];
  const ctx = contextFor(state, request.agentId, at);
  const evaluation = evaluate(request, policy, ctx);
  const entry: ActivityEntry = {
    id: nextId("R"),
    at,
    request,
    sessionId: ctx.session?.id ?? null,
    evaluation,
    ...(evaluation.decision === "REVIEW" ? { resolution: "pending" as const } : {}),
  };
  state.activity.unshift(entry);
  return entry;
}

export function seedState(now = Date.now()): RahoState {
  const state: RahoState = {
    agents: clone(DEMO_AGENTS),
    policies: demoPolicies(now),
    sessions: demoSessions(now),
    activity: [],
    locked: false,
  };
  for (const { ago, resolve, ...request } of DEMO_REQUESTS) {
    const entry = record(state, request, now - ago * 60_000);
    if (resolve && entry.resolution === "pending") {
      entry.resolution = resolve[0];
      entry.resolvedAt = now - resolve[1] * 60_000;
    }
  }
  for (const agent of state.agents) if (PAUSED_AFTER_SEED.includes(agent.id)) agent.status = "paused";
  return state;
}

function load(): RahoState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RahoState;
    return Array.isArray(parsed.agents) && Array.isArray(parsed.activity) ? parsed : null;
  } catch {
    return null;
  }
}

export class DemoAdapter implements RahoAdapter {
  readonly mode = "demo" as const;
  private state: RahoState;
  private listeners = new Set<(state: RahoState) => void>();
  private persist: boolean;

  constructor(persist = true) {
    this.persist = persist;
    // A saved demo that has gone quiet for hours has only expired sessions left: start fresh.
    const saved = persist ? load() : null;
    const lastActivity = saved ? Math.max(0, ...saved.activity.map((e) => e.at)) : 0;
    this.state = saved && Date.now() - lastActivity < STALE_AFTER ? saved : seedState();
  }

  getState(): RahoState {
    return this.state;
  }

  subscribe(listener: (state: RahoState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private commit(): void {
    if (this.persist) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        /* Storage can be unavailable in private windows. The demo still works in memory. */
      }
    }
    for (const listener of this.listeners) listener(this.state);
  }

  /** Demo only: start again from the seeded history. */
  reset(): void {
    this.state = seedState();
    this.commit();
  }

  previewPolicy(request: TxRequest) {
    return evaluate(request, this.policy(request.agentId), contextFor(this.state, request.agentId, Date.now()));
  }

  async checkPolicy(request: TxRequest): Promise<ActivityEntry> {
    const entry = record(this.state, request, Date.now());
    this.commit();
    return entry;
  }

  private policy(agentId: string): Policy {
    const policy = this.state.policies[agentId];
    if (!policy) throw new Error(`Unknown agent ${agentId}`);
    return policy;
  }

  async createPolicy(agentId: string): Promise<Policy> {
    const policy = defaultPolicy(agentId);
    this.state.policies[agentId] = policy;
    this.commit();
    return policy;
  }

  async updatePolicy(policy: Policy): Promise<void> {
    this.state.policies[policy.agentId] = { ...clone(policy), updatedAt: Date.now() };
    this.commit();
  }

  async createSession(agentId: string, { assets, maxValue, hours }: SessionOptions): Promise<Session> {
    const now = Date.now();
    // One live session per agent: opening a new one retires the old one.
    const previous = currentSession(this.state, agentId);
    if (previous && previous.status === "active") previous.status = previous.expiresAt <= now ? "expired" : "revoked";
    const session: Session = {
      id: nextId("S"),
      agentId,
      status: "active",
      assets: [...assets],
      maxValue,
      startedAt: now,
      expiresAt: now + hours * 3_600_000,
    };
    this.state.sessions.push(session);
    this.commit();
    return session;
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = this.state.sessions.find((s) => s.id === sessionId);
    if (session && session.status === "active") session.status = "revoked";
    this.commit();
  }

  private setAgentStatus(agentId: string, status: "active" | "paused"): void {
    const agent = this.state.agents.find((a) => a.id === agentId);
    if (agent) agent.status = status;
    this.commit();
  }

  async pauseAgent(agentId: string): Promise<void> {
    this.setAgentStatus(agentId, "paused");
  }

  async resumeAgent(agentId: string): Promise<void> {
    this.setAgentStatus(agentId, "active");
  }

  private resolve(entryId: string, resolution: "approved" | "rejected"): void {
    const entry = this.state.activity.find((e) => e.id === entryId);
    if (!entry || entry.resolution !== "pending") return;
    entry.resolution = resolution;
    entry.resolvedAt = Date.now();
    this.commit();
  }

  async approveRequest(entryId: string): Promise<void> {
    this.resolve(entryId, "approved");
  }

  async rejectRequest(entryId: string): Promise<void> {
    this.resolve(entryId, "rejected");
  }

  async getActivity(filter: ActivityFilter = {}): Promise<ActivityEntry[]> {
    return this.state.activity.filter(
      (e) =>
        (!filter.agentId || e.request.agentId === filter.agentId) &&
        (!filter.decision || e.evaluation.decision === filter.decision) &&
        (!filter.since || e.at >= filter.since),
    );
  }

  async setEmergencyLock(locked: boolean): Promise<void> {
    this.state.locked = locked;
    this.commit();
  }

  async resetLimits(agentId?: string): Promise<void> {
    for (const policy of Object.values(this.state.policies)) {
      if (!agentId || policy.agentId === agentId) {
        policy.limits = { ...DEFAULT_LIMITS };
        policy.updatedAt = Date.now();
      }
    }
    this.commit();
  }
}
