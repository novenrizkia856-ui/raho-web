/**
 * Minimal EIP-1193 wallet connection: account, chain, and network switching.
 * Transactions are built in src/lib/raho/live.ts. Network details come from src/config.
 */
import { chainConfig } from "../config/index.ts";

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export interface WalletState {
  status: "unavailable" | "disconnected" | "connecting" | "connected";
  address: string;
  chainId: number | null;
  /** True when a Raho network is configured and the wallet is on another one. */
  wrongNetwork: boolean;
  error: string;
}

let state: WalletState = {
  status: typeof window !== "undefined" && window.ethereum ? "disconnected" : "unavailable",
  address: "",
  chainId: null,
  wrongNetwork: false,
  error: "",
};

const listeners = new Set<(s: WalletState) => void>();
const emit = (next: Partial<WalletState>) => {
  state = { ...state, ...next };
  state.wrongNetwork = state.status === "connected" && chainConfig.chainId !== null && state.chainId !== chainConfig.chainId;
  for (const l of listeners) l(state);
};

export const getWallet = (): WalletState => state;

export function onWallet(listener: (s: WalletState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let subscribed = false;
function watch(provider: Eip1193Provider): void {
  if (subscribed) return;
  subscribed = true;
  provider.on?.("accountsChanged", (a) => {
    const list = a as string[];
    emit({ status: list[0] ? "connected" : "disconnected", address: list[0] ?? "" });
  });
  provider.on?.("chainChanged", (c) => emit({ chainId: parseInt(c as string, 16) }));
}

/** Reconnect silently if the site was already authorized. Never prompts. */
export async function restoreWallet(): Promise<void> {
  const provider = window.ethereum;
  if (!provider) return;
  try {
    const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
    if (!accounts[0]) return;
    const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
    emit({ status: "connected", address: accounts[0], chainId: parseInt(chainHex, 16) });
    watch(provider);
  } catch { /* Stay disconnected. */ }
}

/** Ask the wallet to switch to the configured network, adding it when unknown. */
export async function switchNetwork(): Promise<void> {
  const provider = window.ethereum;
  if (!provider || chainConfig.chainId === null) return;
  const chainId = `0x${chainConfig.chainId.toString(16)}`;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId, chainName: chainConfig.chainName, rpcUrls: [chainConfig.rpcUrl],
        nativeCurrency: chainConfig.nativeCurrency,
        blockExplorerUrls: chainConfig.explorerUrl ? [chainConfig.explorerUrl] : [],
      }],
    });
  }
  const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
  emit({ chainId: parseInt(chainHex, 16) });
}

export async function connectWallet(): Promise<WalletState> {
  const provider = window.ethereum;
  if (!provider) {
    emit({ status: "unavailable", error: "No browser wallet found." });
    return state;
  }
  emit({ status: "connecting", error: "" });
  try {
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
    emit({ status: accounts[0] ? "connected" : "disconnected", address: accounts[0] ?? "", chainId: parseInt(chainHex, 16) });
    watch(provider);
  } catch (error) {
    emit({ status: "disconnected", error: (error as { message?: string }).message ?? "Connection was declined." });
  }
  return state;
}

/** Forget the account locally. EIP-1193 has no standard way to revoke access. */
export function disconnectWallet(): void {
  emit({ status: window.ethereum ? "disconnected" : "unavailable", address: "", chainId: null, error: "" });
}
