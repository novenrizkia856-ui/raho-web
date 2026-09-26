/** Domain types shared by the policy engine, the adapters and the UI. */

export type Decision = "ALLOW" | "REVIEW" | "BLOCK";
export const DECISIONS: readonly Decision[] = ["ALLOW", "REVIEW", "BLOCK"];

/** One allow list entry, e.g. `USDC → ALLOW` or `upgrade() → BLOCK`. */
export interface Rule {
  id: string;
  label: string;
  decision: Decision;
}

/** A policy dimension: explicit rules plus what happens to anything unlisted. */
export interface RuleSet {
  rules: Rule[];
  fallback: Decision;
}

export interface Limits {
  /** Above this USD value a request needs a human. */
  autoApprove: number;
  /** Hard cap for a single request. */
  perTransaction: number;
  /** Rolling 24 hour cap across allowed and approved requests. */
  daily: number;
  /** Maximum number of requests per rolling hour. */
  perHour: number;
}

export interface ApprovalRules {
  /** approve() and permit() style calls always go to a human. */
  reviewTokenApprovals: boolean;
  /** Unlimited allowances are refused outright. */
  blockUnlimitedApprovals: boolean;
}

export interface Policy {
  agentId: string;
  assets: RuleSet;
  contracts: RuleSet;
  functions: RuleSet;
  recipients: RuleSet;
  limits: Limits;
  approvals: ApprovalRules;
  /** Default length of a new session, in hours. */
  sessionHours: number;
  updatedAt: number;
}

export type AgentStatus = "active" | "paused";

export interface Agent {
  id: string;
  name: string;
  purpose: string;
  status: AgentStatus;
}

export type SessionStatus = "active" | "expired" | "revoked";

export interface Session {
  id: string;
  agentId: string;
  status: SessionStatus;
  assets: string[];
  /** Spending ceiling for the whole session, USD. */
  maxValue: number;
  startedAt: number;
  expiresAt: number;
}

export type Action = "Transfer" | "Swap" | "Approve" | "Call";

/** What the agent asks for, already decoded into policy relevant fields. */
export interface TxRequest {
  agentId: string;
  action: Action;
  /** Function the agent wants to call, e.g. `transfer()`. */
  fn: string;
  asset: string;
  /** Token units, shown to people. */
  amount: number;
  /** USD equivalent, used for limits. */
  valueUsd: number;
  /** Contract being called. Empty for a plain token transfer. */
  contract: string;
  /** Who receives value or allowance. Empty when nobody does. */
  recipient: string;
  /** Only meaningful for approvals. */
  unlimited?: boolean;
}

export type CheckKey =
  | "guard"
  | "session"
  | "asset"
  | "contract"
  | "function"
  | "recipient"
  | "limits"
  | "approval";

export type CheckResult = "pass" | "review" | "block" | "skip";

export interface Check {
  key: CheckKey;
  label: string;
  result: CheckResult;
  detail: string;
}

export type ReasonCode =
  | "POLICY_SATISFIED"
  | "EMERGENCY_LOCK"
  | "AGENT_PAUSED"
  | "NO_SESSION"
  | "SESSION_EXPIRED"
  | "SESSION_REVOKED"
  | "ASSET_NOT_ALLOWED"
  | "ASSET_REVIEW"
  | "ASSET_OUTSIDE_SESSION"
  | "UNKNOWN_CONTRACT"
  | "CONTRACT_BLOCKED"
  | "CONTRACT_REVIEW"
  | "FUNCTION_BLOCKED"
  | "FUNCTION_REVIEW"
  | "TOKEN_APPROVAL"
  | "UNLIMITED_APPROVAL"
  | "RECIPIENT_BLOCKED"
  | "UNKNOWN_RECIPIENT"
  | "RECIPIENT_REVIEW"
  | "TX_LIMIT_EXCEEDED"
  | "AMOUNT_ABOVE_AUTO_LIMIT"
  | "DAILY_LIMIT_EXCEEDED"
  | "SESSION_LIMIT_EXCEEDED"
  | "RATE_LIMIT_EXCEEDED";

export interface Evaluation {
  decision: Decision;
  reason: ReasonCode;
  /** One short sentence a person can act on. */
  message: string;
  checks: Check[];
}

export type Resolution = "pending" | "approved" | "rejected";

export interface ActivityEntry {
  id: string;
  at: number;
  request: TxRequest;
  sessionId: string | null;
  evaluation: Evaluation;
  /** Only set for REVIEW decisions. */
  resolution?: Resolution;
  resolvedAt?: number;
}

/** Everything the engine needs to know about the world besides the policy. */
export interface EvaluationContext {
  now: number;
  locked: boolean;
  agent: Agent | undefined;
  session: Session | undefined;
  /** USD already let through in the rolling 24 hours. */
  spentToday: number;
  /** USD already let through in this session. */
  spentInSession: number;
  /** Requests made in the rolling hour, before this one. */
  requestsThisHour: number;
}

export interface RahoState {
  agents: Agent[];
  policies: Record<string, Policy>;
  sessions: Session[];
  activity: ActivityEntry[];
  locked: boolean;
}
