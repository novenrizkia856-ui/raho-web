/**
 * The boundary between the UI and whatever enforces Raho policy.
 *
 * Today the only working implementation is the local demo adapter. Once the
 * contracts are deployed, `contract-adapter.ts` implements this same
 * interface against them and the UI keeps working unchanged.
 */
import type { ActivityEntry, Decision, Evaluation, Policy, RahoState, Session, TxRequest } from "./types.ts";

export interface SessionOptions {
  assets: string[];
  maxValue: number;
  hours: number;
}

export interface ActivityFilter {
  agentId?: string;
  decision?: Decision;
  since?: number;
}

export interface RahoAdapter {
  /** "demo" runs entirely in this browser. "contract" reads and writes the chain. */
  readonly mode: "demo" | "contract";

  /** Latest known state, for rendering. */
  getState(): RahoState;
  /** Called after every change. Returns an unsubscribe function. */
  subscribe(listener: (state: RahoState) => void): () => void;

  /** Evaluate a proposed request without recording it. */
  previewPolicy(request: TxRequest): Evaluation;
  /** Evaluate a proposed request and record the decision. */
  checkPolicy(request: TxRequest): Promise<ActivityEntry>;

  createPolicy(agentId: string): Promise<Policy>;
  updatePolicy(policy: Policy): Promise<void>;

  createSession(agentId: string, options: SessionOptions): Promise<Session>;
  revokeSession(sessionId: string): Promise<void>;

  pauseAgent(agentId: string): Promise<void>;
  resumeAgent(agentId: string): Promise<void>;

  approveRequest(entryId: string): Promise<void>;
  rejectRequest(entryId: string): Promise<void>;

  getActivity(filter?: ActivityFilter): Promise<ActivityEntry[]>;

  /** Blocks every agent until switched off. Overrides all allow rules. */
  setEmergencyLock(locked: boolean): Promise<void>;
  /** Restores conservative default limits, for one agent or all of them. */
  resetLimits(agentId?: string): Promise<void>;
}
