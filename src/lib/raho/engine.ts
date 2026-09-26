/**
 * The Raho decision engine.
 *
 * Pure and deterministic: the same request, policy and context always give
 * the same result. It runs the checks in the documented order, stops at the
 * first BLOCK, and resolves the final outcome as BLOCK > REVIEW > ALLOW.
 * No chain access happens here; adapters supply the context.
 */
import type {
  Check,
  CheckKey,
  Decision,
  Evaluation,
  EvaluationContext,
  Policy,
  ReasonCode,
  Rule,
  RuleSet,
  Session,
  TxRequest,
} from "./types.ts";

const RANK: Record<Decision, number> = { ALLOW: 0, REVIEW: 1, BLOCK: 2 };

export const strongest = (a: Decision, b: Decision): Decision => (RANK[a] >= RANK[b] ? a : b);

export const CHECK_LABELS: Record<CheckKey, string> = {
  guard: "Controls",
  session: "Session",
  asset: "Asset",
  contract: "Contract",
  function: "Function",
  recipient: "Recipient",
  limits: "Limits",
  approval: "Approval",
};

export const CHECK_ORDER: CheckKey[] = [
  "guard",
  "session",
  "asset",
  "contract",
  "function",
  "recipient",
  "limits",
  "approval",
];

export const REASON_TEXT: Record<ReasonCode, string> = {
  POLICY_SATISFIED: "Every rule passed.",
  EMERGENCY_LOCK: "Emergency lock is on.",
  AGENT_PAUSED: "This agent is paused.",
  NO_SESSION: "The agent has no session.",
  SESSION_EXPIRED: "The session has expired.",
  SESSION_REVOKED: "The session was revoked.",
  ASSET_NOT_ALLOWED: "This asset is not allowed.",
  ASSET_REVIEW: "This asset needs a human.",
  ASSET_OUTSIDE_SESSION: "This asset is outside the session.",
  UNKNOWN_CONTRACT: "Unknown contract.",
  CONTRACT_BLOCKED: "This contract is blocked.",
  CONTRACT_REVIEW: "This contract needs a human.",
  FUNCTION_BLOCKED: "This function is blocked.",
  FUNCTION_REVIEW: "This function needs a human.",
  TOKEN_APPROVAL: "Token approvals need a human.",
  UNLIMITED_APPROVAL: "Unlimited approvals are refused.",
  RECIPIENT_BLOCKED: "This recipient is blocked.",
  UNKNOWN_RECIPIENT: "Unknown recipient.",
  RECIPIENT_REVIEW: "This recipient needs a human.",
  TX_LIMIT_EXCEEDED: "Amount is above the transaction limit.",
  AMOUNT_ABOVE_AUTO_LIMIT: "Amount exceeds automatic limit.",
  DAILY_LIMIT_EXCEEDED: "Daily limit would be exceeded.",
  SESSION_LIMIT_EXCEEDED: "Session ceiling would be exceeded.",
  RATE_LIMIT_EXCEEDED: "Too many requests this hour.",
};

/** `swap()`, `Swap`, `swap` all mean the same function. */
export const normalize = (label: string): string =>
  label.trim().toLowerCase().replace(/\(.*\)$/, "");

export function matchRule(set: RuleSet, label: string): { rule: Rule | undefined; decision: Decision } {
  const key = normalize(label);
  const rule = set.rules.find((r) => normalize(r.label) === key);
  return { rule, decision: rule ? rule.decision : set.fallback };
}

export function sessionState(session: Session | undefined, now: number): "none" | "active" | "expired" | "revoked" {
  if (!session) return "none";
  if (session.status === "revoked") return "revoked";
  if (session.status === "expired" || session.expiresAt <= now) return "expired";
  return "active";
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

interface Step {
  key: CheckKey;
  result: Exclude<Check["result"], "skip">;
  detail: string;
  reason?: ReasonCode;
}

export function evaluate(request: TxRequest, policy: Policy, ctx: EvaluationContext): Evaluation {
  const steps: Step[] = [];
  let final = "ALLOW" as Decision;
  let blockReason: ReasonCode | undefined;
  let reviewReason: ReasonCode | undefined;

  const record = (step: Step): boolean => {
    steps.push(step);
    if (step.result === "block") {
      final = "BLOCK";
      blockReason ??= step.reason;
      return true;
    }
    if (step.result === "review") {
      final = strongest(final, "REVIEW");
      reviewReason ??= step.reason;
    }
    return false;
  };

  const fromDecision = (d: Decision): Step["result"] => (d === "ALLOW" ? "pass" : d === "REVIEW" ? "review" : "block");

  run: {
    // 1. Owner controls dominate everything else.
    if (ctx.locked) {
      if (record({ key: "guard", result: "block", detail: "Emergency lock", reason: "EMERGENCY_LOCK" })) break run;
    } else if (!ctx.agent || ctx.agent.status === "paused") {
      if (record({ key: "guard", result: "block", detail: "Agent paused", reason: "AGENT_PAUSED" })) break run;
    } else {
      record({ key: "guard", result: "pass", detail: "Agent active" });
    }

    // 2. Only an active session can ever lead to ALLOW.
    const state = sessionState(ctx.session, ctx.now);
    if (state !== "active") {
      const reason: ReasonCode =
        state === "none" ? "NO_SESSION" : state === "expired" ? "SESSION_EXPIRED" : "SESSION_REVOKED";
      const detail = state === "none" ? "No session" : state === "expired" ? "Expired" : "Revoked";
      if (record({ key: "session", result: "block", detail, reason })) break run;
    }
    const session = ctx.session as Session;
    record({ key: "session", result: "pass", detail: "Active" });

    // 3. Asset.
    const asset = matchRule(policy.assets, request.asset);
    const assetReason: ReasonCode = asset.decision === "BLOCK" ? "ASSET_NOT_ALLOWED" : "ASSET_REVIEW";
    if (
      record({
        key: "asset",
        result: fromDecision(asset.decision),
        detail: asset.rule
          ? `${request.asset} ${asset.decision === "ALLOW" ? "allowed" : asset.decision === "REVIEW" ? "needs review" : "blocked"}`
          : `${request.asset} unlisted`,
        reason: assetReason,
      })
    )
      break run;
    if (!session.assets.some((a) => normalize(a) === normalize(request.asset))) {
      if (record({ key: "asset", result: "block", detail: "Outside session", reason: "ASSET_OUTSIDE_SESSION" })) break run;
    }

    // 4. Contract. A plain token transfer calls no third party contract.
    if (request.contract) {
      const c = matchRule(policy.contracts, request.contract);
      const reason: ReasonCode = !c.rule
        ? "UNKNOWN_CONTRACT"
        : c.decision === "BLOCK"
          ? "CONTRACT_BLOCKED"
          : "CONTRACT_REVIEW";
      const detail = c.rule ? (c.decision === "ALLOW" ? "Known contract" : request.contract) : "Unknown contract";
      if (record({ key: "contract", result: fromDecision(c.decision), detail, reason })) break run;
    } else {
      record({ key: "contract", result: "pass", detail: "Direct transfer" });
    }

    // 5. Function.
    const f = matchRule(policy.functions, request.fn);
    const fnReason: ReasonCode = f.decision === "BLOCK" ? "FUNCTION_BLOCKED" : "FUNCTION_REVIEW";
    if (record({ key: "function", result: fromDecision(f.decision), detail: request.fn, reason: fnReason })) break run;

    // 6. Recipient.
    if (request.recipient) {
      const r = matchRule(policy.recipients, request.recipient);
      const reason: ReasonCode = r.decision === "BLOCK" ? "RECIPIENT_BLOCKED" : r.rule ? "RECIPIENT_REVIEW" : "UNKNOWN_RECIPIENT";
      const detail = r.rule ? (r.decision === "ALLOW" ? "Approved" : request.recipient) : "Unknown";
      if (record({ key: "recipient", result: fromDecision(r.decision), detail, reason })) break run;
    } else {
      record({ key: "recipient", result: "pass", detail: "None" });
    }

    // 7. Limits are simultaneous constraints, checked hardest first.
    const { limits } = policy;
    const value = request.valueUsd;
    if (value > limits.perTransaction) {
      if (record({ key: "limits", result: "block", detail: `Over ${usd(limits.perTransaction)}`, reason: "TX_LIMIT_EXCEEDED" })) break run;
    }
    if (ctx.spentToday + value > limits.daily) {
      if (record({ key: "limits", result: "block", detail: `Over ${usd(limits.daily)} daily`, reason: "DAILY_LIMIT_EXCEEDED" })) break run;
    }
    if (ctx.spentInSession + value > session.maxValue) {
      if (record({ key: "limits", result: "block", detail: `Over ${usd(session.maxValue)} session`, reason: "SESSION_LIMIT_EXCEEDED" })) break run;
    }
    if (ctx.requestsThisHour >= limits.perHour) {
      if (record({ key: "limits", result: "block", detail: `${limits.perHour} per hour`, reason: "RATE_LIMIT_EXCEEDED" })) break run;
    }
    record({ key: "limits", result: "pass", detail: `${usd(ctx.spentToday + value)} of ${usd(limits.daily)}` });

    // 8. Approval requirements.
    const isApproval = request.action === "Approve" || /^(approve|permit|increaseallowance)$/.test(normalize(request.fn));
    if (isApproval && request.unlimited && policy.approvals.blockUnlimitedApprovals) {
      if (record({ key: "approval", result: "block", detail: "Unlimited allowance", reason: "UNLIMITED_APPROVAL" })) break run;
    }
    if (isApproval && policy.approvals.reviewTokenApprovals) {
      record({ key: "approval", result: "review", detail: "Token approval", reason: "TOKEN_APPROVAL" });
    } else if (value > limits.autoApprove) {
      record({ key: "approval", result: "review", detail: `Above ${usd(limits.autoApprove)}`, reason: "AMOUNT_ABOVE_AUTO_LIMIT" });
    } else {
      record({ key: "approval", result: "pass", detail: "Not required" });
    }
  }

  // One row per check key, in order. A later step for the same key wins,
  // so an asset allowed by policy but outside the session reads as blocked.
  const byKey = new Map<CheckKey, Step>();
  for (const step of steps) {
    const prev = byKey.get(step.key);
    if (!prev || step.result !== "pass") byKey.set(step.key, step);
  }
  const checks: Check[] = CHECK_ORDER.map((key) => {
    const step = byKey.get(key);
    return step
      ? { key, label: CHECK_LABELS[key], result: step.result, detail: step.detail }
      : { key, label: CHECK_LABELS[key], result: "skip", detail: "Not reached" };
  });

  const reason: ReasonCode = final === "BLOCK" ? blockReason! : final === "REVIEW" ? reviewReason! : "POLICY_SATISFIED";
  return { decision: final, reason, message: REASON_TEXT[reason], checks };
}
