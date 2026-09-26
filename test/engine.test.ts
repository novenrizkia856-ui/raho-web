import assert from "node:assert/strict";
import { test } from "node:test";
import { contractsReady, tokenDisplay, contracts, deployment, chainConfig } from "../src/config/index.ts";
import { demoPolicies, demoSessions, DEMO_AGENTS } from "../src/lib/raho/demo-data.ts";
import { DemoAdapter, seedState } from "../src/lib/raho/demo-adapter.ts";
import { evaluate, strongest } from "../src/lib/raho/engine.ts";
import { pendingApprovals } from "../src/lib/raho/selectors.ts";
import type { EvaluationContext, TxRequest } from "../src/lib/raho/types.ts";

const now = Date.UTC(2026, 8, 26, 12);
const policy = demoPolicies(now).payment;
const session = demoSessions(now).find((s) => s.agentId === "payment")!;
const agent = { ...DEMO_AGENTS[0] };

const ctx = (over: Partial<EvaluationContext> = {}): EvaluationContext => ({
  now,
  locked: false,
  agent,
  session,
  spentToday: 0,
  spentInSession: 0,
  requestsThisHour: 0,
  ...over,
});

const transfer = (over: Partial<TxRequest> = {}): TxRequest => ({
  agentId: "payment",
  action: "Transfer",
  fn: "transfer()",
  asset: "USDC",
  amount: 50,
  valueUsd: 50,
  contract: "",
  recipient: "Approved Wallet",
  ...over,
});

test("precedence is BLOCK > REVIEW > ALLOW", () => {
  assert.equal(strongest("ALLOW", "REVIEW"), "REVIEW");
  assert.equal(strongest("BLOCK", "REVIEW"), "BLOCK");
  assert.equal(strongest("ALLOW", "ALLOW"), "ALLOW");
});

test("50 USDC to an approved wallet is allowed", () => {
  const r = evaluate(transfer(), policy, ctx());
  assert.equal(r.decision, "ALLOW");
  assert.equal(r.reason, "POLICY_SATISFIED");
  assert.ok(r.checks.every((c) => c.result === "pass"));
});

test("500 USDC goes to human review: amount exceeds automatic limit", () => {
  const r = evaluate(transfer({ amount: 500, valueUsd: 500 }), policy, ctx());
  assert.equal(r.decision, "REVIEW");
  assert.equal(r.reason, "AMOUNT_ABOVE_AUTO_LIMIT");
  assert.equal(r.message, "Amount exceeds automatic limit.");
});

test("an unlisted asset is blocked and later checks are skipped", () => {
  const r = evaluate(transfer({ asset: "TOKEN X" }), policy, ctx());
  assert.equal(r.decision, "BLOCK");
  assert.equal(r.reason, "ASSET_NOT_ALLOWED");
  assert.equal(r.checks.find((c) => c.key === "limits")!.result, "skip");
});

test("unknown contracts and recipients review, never allow", () => {
  assert.equal(evaluate(transfer({ recipient: "Stranger" }), policy, ctx()).reason, "UNKNOWN_RECIPIENT");
  const call = transfer({ action: "Call", fn: "transfer()", contract: "Mystery", recipient: "" });
  assert.equal(evaluate(call, policy, ctx()).reason, "UNKNOWN_CONTRACT");
});

test("a BLOCK anywhere beats an earlier REVIEW", () => {
  const r = evaluate(transfer({ recipient: "Stranger", amount: 5000, valueUsd: 5000 }), policy, ctx());
  assert.equal(r.decision, "BLOCK");
  assert.equal(r.reason, "TX_LIMIT_EXCEEDED");
});

test("small requests still fail an exhausted daily limit", () => {
  const r = evaluate(transfer({ amount: 70, valueUsd: 70 }), policy, ctx({ spentToday: 1950 }));
  assert.equal(r.reason, "DAILY_LIMIT_EXCEEDED");
});

test("emergency lock, paused agents and dead sessions block before any rule", () => {
  assert.equal(evaluate(transfer(), policy, ctx({ locked: true })).reason, "EMERGENCY_LOCK");
  assert.equal(evaluate(transfer(), policy, ctx({ agent: { ...agent, status: "paused" } })).reason, "AGENT_PAUSED");
  assert.equal(evaluate(transfer(), policy, ctx({ session: { ...session, status: "revoked" } })).reason, "SESSION_REVOKED");
  assert.equal(evaluate(transfer(), policy, ctx({ now: session.expiresAt + 1 })).reason, "SESSION_EXPIRED");
  assert.equal(evaluate(transfer(), policy, ctx({ session: undefined })).reason, "NO_SESSION");
});

test("token approvals review, unlimited approvals block", () => {
  const approve = transfer({ action: "Approve", fn: "approve()", contract: "Payments Router", recipient: "" });
  assert.equal(evaluate(approve, policy, ctx()).decision, "REVIEW");
  assert.equal(evaluate({ ...approve, unlimited: true }, policy, ctx()).reason, "UNLIMITED_APPROVAL");
});

test("assets outside the session scope are blocked", () => {
  const r = evaluate(transfer(), policy, ctx({ session: { ...session, assets: ["USDT"] } }));
  assert.equal(r.reason, "ASSET_OUTSIDE_SESSION");
  assert.equal(r.checks.find((c) => c.key === "asset")!.result, "block");
});

test("seeded demo history covers all three decisions and has pending approvals", () => {
  const state = seedState(now);
  const decisions = new Set(state.activity.map((e) => e.evaluation.decision));
  assert.deepEqual([...decisions].sort(), ["ALLOW", "BLOCK", "REVIEW"]);
  assert.equal(pendingApprovals(state).length, 3);
  assert.equal(state.agents.find((a) => a.id === "ops")!.status, "paused");
});

test("demo adapter: approving resolves once, lock blocks new requests", async () => {
  const raho = new DemoAdapter(false);
  const [first] = pendingApprovals(raho.getState());
  await raho.approveRequest(first.id);
  await raho.rejectRequest(first.id);
  assert.equal(raho.getState().activity.find((e) => e.id === first.id)!.resolution, "approved");
  await raho.setEmergencyLock(true);
  const entry = await raho.checkPolicy(transfer({ amount: 5, valueUsd: 5 }));
  assert.equal(entry.evaluation.reason, "EMERGENCY_LOCK");
});

test("config ships empty: no token, no contracts, demo mode", () => {
  for (const [name, value] of Object.entries(contracts)) assert.equal(value, "", `contracts.${name}`);
  assert.equal(deployment.contractsLive, false);
  assert.equal(deployment.tokenLive, false);
  assert.equal(chainConfig.chainId, null);
  assert.equal(contractsReady(), false);
  assert.deepEqual(tokenDisplay(), { label: "Coming Soon", copyValue: "", live: false });
});
