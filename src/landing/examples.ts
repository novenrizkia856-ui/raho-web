/**
 * The one example policy the landing page reasons with. The flow, preview
 * and policy sheet all show results from the real engine against it.
 */
import { evaluate } from "../lib/raho/engine.ts";
import type { Evaluation, EvaluationContext, Policy, TxRequest } from "../lib/raho/types.ts";

let id = 0;
const rule = (label: string, decision: "ALLOW" | "REVIEW" | "BLOCK") => ({ id: `l${++id}`, label, decision });

export const LANDING_POLICY: Policy = {
  agentId: "payment",
  assets: { fallback: "BLOCK", rules: [rule("USDC", "ALLOW")] },
  contracts: { fallback: "REVIEW", rules: [rule("Approved Protocol", "ALLOW")] },
  functions: {
    fallback: "BLOCK",
    rules: [rule("transfer()", "ALLOW"), rule("swap()", "ALLOW"), rule("approve()", "REVIEW"), rule("upgrade()", "BLOCK")],
  },
  recipients: { fallback: "REVIEW", rules: [rule("Approved Wallet", "ALLOW")] },
  limits: { autoApprove: 100, perTransaction: 1000, daily: 500, perHour: 20 },
  approvals: { reviewTokenApprovals: true, blockUnlimitedApprovals: true },
  sessionHours: 2,
  updatedAt: 0,
};

function context(): EvaluationContext {
  const now = Date.now();
  return {
    now,
    locked: false,
    agent: { id: "payment", name: "Payment Agent", purpose: "", status: "active" },
    session: { id: "S-DEMO", agentId: "payment", status: "active", assets: ["USDC"], maxValue: 1000, startedAt: now, expiresAt: now + 7_200_000 },
    spentToday: 0,
    spentInSession: 0,
    requestsThisHour: 0,
  };
}

export const run = (request: TxRequest): Evaluation => evaluate(request, LANDING_POLICY, context());

const base: TxRequest = {
  agentId: "payment",
  action: "Transfer",
  fn: "transfer()",
  asset: "USDC",
  amount: 50,
  valueUsd: 50,
  contract: "",
  recipient: "Approved Wallet",
};

export interface Sample {
  label: string;
  agent: string;
  request: TxRequest;
}

export const FLOW_SAMPLES: Sample[] = [
  { label: "Transfer 50 USDC", agent: "Payment Agent", request: base },
  { label: "Transfer 500 USDC", agent: "Payment Agent", request: { ...base, amount: 500, valueUsd: 500 } },
  {
    label: "approve() unknown contract",
    agent: "Treasury Agent",
    request: { ...base, action: "Approve", fn: "approve()", amount: 200, valueUsd: 200, contract: "Unknown Contract", recipient: "" },
  },
  { label: "Transfer 200 TOKEN X", agent: "Payment Agent", request: { ...base, asset: "TOKEN X", amount: 200, valueUsd: 200 } },
  {
    label: "upgrade() on protocol",
    agent: "Treasury Agent",
    request: { ...base, action: "Call", fn: "upgrade()", amount: 0, valueUsd: 0, contract: "Approved Protocol", recipient: "" },
  },
];

export const PREVIEW_SAMPLES: Record<"ALLOW" | "REVIEW" | "BLOCK", Sample> = {
  ALLOW: { label: "Transfer", agent: "Payment Agent", request: base },
  REVIEW: { label: "Transfer", agent: "Payment Agent", request: { ...base, amount: 500, valueUsd: 500 } },
  BLOCK: {
    label: "Approve",
    agent: "Treasury Agent",
    request: { ...base, action: "Approve", fn: "approve()", amount: 0, valueUsd: 0, unlimited: true, contract: "Unknown Router", recipient: "" },
  },
};
