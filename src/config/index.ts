/**
 * Read only view over the raw config. Components import from here, never
 * from the raw files, so a half filled config can never leak into the UI.
 */
import { chainConfig } from "./chain.ts";
import { contracts, deployment, TOKEN_PENDING_LABEL, type ContractAddresses } from "./contracts.ts";

export { chainConfig, contracts, deployment };

export const isAddress = (value: string): boolean => /^0x[0-9a-fA-F]{40}$/.test(value.trim());

/** An address only counts once it is well formed. Anything else reads as not deployed. */
export function contractAddress(name: keyof ContractAddresses): string {
  const value = contracts[name] ?? "";
  return isAddress(value) ? value.trim() : "";
}

export interface TokenDisplay {
  /** What the landing page prints in the address field. */
  label: string;
  /** What the copy button copies. Empty means there is nothing to copy. */
  copyValue: string;
  live: boolean;
}

export function tokenDisplay(): TokenDisplay {
  const address = contractAddress("token");
  const live = deployment.tokenLive && address !== "";
  return live
    ? { label: address, copyValue: address, live: true }
    : { label: TOKEN_PENDING_LABEL, copyValue: "", live: false };
}

/** The contract adapter is used only when the flag is on and the core contracts exist. */
export function contractsReady(): boolean {
  return (
    deployment.contractsLive &&
    chainConfig.chainId !== null &&
    chainConfig.rpcUrl !== "" &&
    contractAddress("firewall") !== "" &&
    contractAddress("policy") !== "" &&
    contractAddress("session") !== ""
  );
}

export function explorerLink(kind: "address" | "tx", value: string): string {
  if (!chainConfig.explorerUrl || !value) return "";
  return `${chainConfig.explorerUrl.replace(/\/+$/, "")}/${kind}/${value}`;
}

export function shortAddress(value: string): string {
  return isAddress(value) ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}
