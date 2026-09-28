import { chainConfig } from "./chain.ts";
import { contracts, deployment, type ContractName } from "./contracts.ts";

export { chainConfig, contracts, deployment };
export const isAddress = (value: string): boolean => /^0x[0-9a-fA-F]{40}$/.test(value.trim());
export const shortAddress = (value: string): string => isAddress(value) ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
export const contractAddress = (name: ContractName): `0x${string}` | "" =>
  isAddress(contracts[name]) ? contracts[name].trim() as `0x${string}` : "";
/** Landing address is the token CA. It never displays the migration contracts. */
export const tokenDisplay = () => {
  const address = contractAddress("token");
  const live = deployment.tokenLive && address !== "";
  return { label: live ? address : "Coming Soon", copyValue: live ? address : "", live };
};
export const contractsReady = (): boolean =>
  deployment.contractsLive && chainConfig.chainId !== null && chainConfig.rpcUrl !== "" &&
  (["registry", "manager", "factory"] as const).every((name) => contractAddress(name) !== "");
export const explorerLink = (kind: "address" | "tx", value: string): string =>
  chainConfig.explorerUrl ? `${chainConfig.explorerUrl}/${kind}/${value}` : "";
