/**
 * Network the Raho contracts live on. Repoint a deployment by editing this file
 * and `contracts.ts`. No UI component needs to change.
 */
export interface ChainConfig {
  /** EIP-155 chain id. `null` when no network is configured. */
  chainId: number | null;
  /** Human readable network name shown in the app. */
  chainName: string;
  /** Public JSON-RPC endpoint. Never put a private key or paid API secret here. */
  rpcUrl: string;
  /** Block explorer base URL without a trailing slash. */
  explorerUrl: string;
  /** Native currency, used when asking a wallet to add the network. */
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

export const chainConfig: ChainConfig = {
  chainId: 4663,
  chainName: "Robinhood Chain",
  /** VITE_RAHO_RPC_URL overrides it for local rehearsals, e.g. `vite --mode fork` against an anvil fork. */
  rpcUrl: import.meta.env?.VITE_RAHO_RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
  explorerUrl: "https://robinhoodchain.blockscout.com",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
};
