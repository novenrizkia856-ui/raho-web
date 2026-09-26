/**
 * Network the Raho contracts will live on.
 *
 * Nothing is deployed yet, so every value is empty. When the contracts ship,
 * fill in this object and `contracts.ts`. No UI component needs to change.
 */
export interface ChainConfig {
  /** EIP-155 chain id, e.g. 8453. `null` until a network is chosen. */
  chainId: number | null;
  /** Human readable network name shown in the app. */
  chainName: string;
  /** Public JSON-RPC endpoint. Never put a private key or paid API secret here. */
  rpcUrl: string;
  /** Block explorer base URL without a trailing slash, e.g. https://basescan.org */
  explorerUrl: string;
  /** Native currency, used when asking a wallet to add the network. */
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

export const chainConfig: ChainConfig = {
  chainId: null,
  chainName: "",
  rpcUrl: "",
  explorerUrl: "",
  nativeCurrency: { name: "", symbol: "", decimals: 18 },
};
