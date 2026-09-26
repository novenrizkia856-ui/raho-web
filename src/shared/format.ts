import type { TxRequest } from "../lib/raho/types.ts";

export const usd = (n: number): string => `$${Math.round(n).toLocaleString("en-US")}`;

export function amount(request: Pick<TxRequest, "amount" | "asset" | "action" | "unlimited">): string {
  if (request.action === "Approve" && request.unlimited) return `Unlimited ${request.asset}`;
  return `${request.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${request.asset}`;
}

/** "Transfer 50 USDC", "Swap 800 USDC", "upgrade() call". */
export function describe(request: TxRequest): string {
  if (request.action === "Call" && request.amount === 0) return `${request.fn} call`;
  if (request.action === "Call") return `${request.fn.replace("()", "")} ${amount(request)}`;
  return `${request.action} ${amount(request)}`;
}

export const target = (request: TxRequest): string => request.recipient || request.contract || "None";

export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function duration(ms: number): string {
  if (ms <= 0) return "Ended";
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const time = (ts: number): string =>
  new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function ago(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export const titleCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
