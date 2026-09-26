/**
 * Local demo data. Agents, contracts and recipients are named, never given
 * addresses, so nothing here can be mistaken for something deployed.
 */
import type { Agent, Policy, RuleSet, Session, TxRequest } from "./types.ts";

let n = 0;
const rules = (fallback: RuleSet["fallback"], entries: [string, RuleSet["fallback"]][]): RuleSet => ({
  fallback,
  rules: entries.map(([label, decision]) => ({ id: `r${++n}`, label, decision })),
});

export function defaultPolicy(agentId: string, now = Date.now()): Policy {
  return {
    agentId,
    assets: rules("BLOCK", [["USDC", "ALLOW"]]),
    contracts: rules("REVIEW", []),
    functions: rules("BLOCK", [
      ["transfer()", "ALLOW"],
      ["approve()", "REVIEW"],
      ["upgrade()", "BLOCK"],
    ]),
    recipients: rules("REVIEW", []),
    limits: { autoApprove: 50, perTransaction: 100, daily: 250, perHour: 10 },
    approvals: { reviewTokenApprovals: true, blockUnlimitedApprovals: true },
    sessionHours: 2,
    updatedAt: now,
  };
}

/** Conservative limits restored by the Reset Limits emergency control. */
export const DEFAULT_LIMITS = defaultPolicy("").limits;

export const ASSETS = ["USDC", "USDT", "WETH", "TOKEN X"] as const;

export const DEMO_AGENTS: Agent[] = [
  { id: "payment", name: "Payment Agent", purpose: "Pays approved invoices", status: "active" },
  { id: "research", name: "Research Agent", purpose: "Buys data and API credits", status: "active" },
  { id: "treasury", name: "Treasury Agent", purpose: "Rebalances stablecoins", status: "active" },
  { id: "ops", name: "Ops Agent", purpose: "Pays cloud bills", status: "active" },
];

export function demoPolicies(now: number): Record<string, Policy> {
  return {
    payment: {
      ...defaultPolicy("payment", now),
      assets: rules("BLOCK", [["USDC", "ALLOW"], ["USDT", "ALLOW"]]),
      contracts: rules("REVIEW", [["Payments Router", "ALLOW"]]),
      functions: rules("BLOCK", [["transfer()", "ALLOW"], ["approve()", "REVIEW"], ["upgrade()", "BLOCK"]]),
      recipients: rules("REVIEW", [["Approved Wallet", "ALLOW"], ["Payroll Safe", "ALLOW"], ["Cloud Vendor", "ALLOW"]]),
      limits: { autoApprove: 250, perTransaction: 1000, daily: 2000, perHour: 20 },
      sessionHours: 12,
    },
    research: {
      ...defaultPolicy("research", now),
      contracts: rules("REVIEW", [["Data Market", "ALLOW"]]),
      functions: rules("BLOCK", [["transfer()", "ALLOW"], ["purchase()", "ALLOW"], ["approve()", "REVIEW"]]),
      recipients: rules("REVIEW", [["Data Vendor", "ALLOW"]]),
      limits: { autoApprove: 50, perTransaction: 100, daily: 100, perHour: 10 },
    },
    treasury: {
      ...defaultPolicy("treasury", now),
      assets: rules("BLOCK", [["USDC", "ALLOW"], ["USDT", "ALLOW"], ["WETH", "ALLOW"]]),
      contracts: rules("BLOCK", [["Known DEX", "ALLOW"], ["Lending Pool", "REVIEW"]]),
      functions: rules("BLOCK", [["swap()", "ALLOW"], ["deposit()", "ALLOW"], ["approve()", "REVIEW"], ["upgrade()", "BLOCK"]]),
      recipients: rules("BLOCK", [["Treasury Safe", "ALLOW"]]),
      limits: { autoApprove: 1000, perTransaction: 2500, daily: 5000, perHour: 12 },
      sessionHours: 8,
    },
    ops: {
      ...defaultPolicy("ops", now),
      recipients: rules("REVIEW", [["Cloud Vendor", "ALLOW"]]),
      limits: { autoApprove: 100, perTransaction: 250, daily: 500, perHour: 10 },
    },
  };
}

const MIN = 60_000;
const HR = 60 * MIN;

export function demoSessions(now: number): Session[] {
  return [
    { id: "S-4102", agentId: "payment", status: "active", assets: ["USDC", "USDT"], maxValue: 2000, startedAt: now - 6 * HR, expiresAt: now + 6 * HR },
    { id: "S-4107", agentId: "treasury", status: "active", assets: ["USDC", "USDT", "WETH"], maxValue: 5000, startedAt: now - 6 * HR - 10 * MIN, expiresAt: now + 110 * MIN },
    { id: "S-4093", agentId: "ops", status: "active", assets: ["USDC"], maxValue: 500, startedAt: now - 160 * MIN, expiresAt: now - 40 * MIN },
    { id: "S-4119", agentId: "research", status: "active", assets: ["USDC"], maxValue: 100, startedAt: now - 10 * MIN, expiresAt: now + 110 * MIN },
  ];
}

type Seed = { ago: number; resolve?: ["approved" | "rejected", number] } & TxRequest;

const tx = (
  ago: number,
  agentId: string,
  action: TxRequest["action"],
  fn: string,
  asset: string,
  amount: number,
  contract: string,
  recipient: string,
  extra: Partial<Seed> = {},
): Seed => ({ ago, agentId, action, fn, asset, amount, valueUsd: amount, contract, recipient, ...extra });

/** Requests replayed through the engine, oldest first, to build the history. */
export const DEMO_REQUESTS: Seed[] = [
  tx(355, "treasury", "Swap", "swap()", "USDC", 800, "Known DEX", ""),
  tx(340, "payment", "Transfer", "transfer()", "USDC", 120, "", "Cloud Vendor"),
  tx(318, "payment", "Transfer", "transfer()", "USDC", 40, "", "Approved Wallet"),
  tx(290, "treasury", "Approve", "approve()", "USDC", 3000, "Unknown Router", "Unknown Router", { unlimited: true }),
  tx(262, "treasury", "Call", "deposit()", "USDT", 900, "Lending Pool", "", { resolve: ["approved", 250] }),
  tx(230, "payment", "Transfer", "transfer()", "USDT", 75, "", "Payroll Safe"),
  tx(180, "treasury", "Call", "upgrade()", "USDC", 0, "Known DEX", ""),
  tx(150, "ops", "Transfer", "transfer()", "USDC", 30, "", "Cloud Vendor"),
  tx(122, "payment", "Transfer", "transfer()", "USDC", 80, "", "New Recipient", { resolve: ["rejected", 110] }),
  tx(60, "ops", "Transfer", "transfer()", "TOKEN X", 200, "", "Cloud Vendor"),
  tx(44, "payment", "Approve", "approve()", "USDC", 300, "Payments Router", ""),
  tx(26, "treasury", "Swap", "swap()", "USDC", 1500, "Known DEX", ""),
  tx(12, "payment", "Transfer", "transfer()", "USDC", 500, "", "Approved Wallet"),
  tx(8, "research", "Call", "purchase()", "USDC", 20, "Data Market", "Data Vendor"),
  tx(5, "research", "Transfer", "transfer()", "USDC", 18, "", "Data Vendor"),
  tx(3, "research", "Transfer", "transfer()", "USDC", 150, "", "Data Vendor"),
  tx(2, "payment", "Transfer", "transfer()", "USDC", 25, "", "Approved Wallet"),
];

/** Agents that end the seed paused, after their history was recorded. */
export const PAUSED_AFTER_SEED = ["ops"];

/** Contracts and recipients offered in the simulator. */
export const KNOWN_TARGETS = {
  contracts: ["Payments Router", "Data Market", "Known DEX", "Lending Pool", "Unknown Router"],
  recipients: ["Approved Wallet", "Payroll Safe", "Cloud Vendor", "Data Vendor", "Treasury Safe", "New Recipient"],
};
