/**
 * Deployed addresses, from raho-contracts/deployments/<chainId>.json.
 * Empty values keep the matching feature offline.
 */
export const contracts = {
  registry: "0x835f415fBc720d13982420d48b83c6e13B7F2173",
  manager: "0xde85C0e3173f8187f09931Dbba24Ec7148C444d9",
  factory: "0x09229D283Ac22e345DD5fa580E6e95b1029815a6",
  verifier: "0xE0e80602d0a49dbcf6703f2802E5D248e2160fd3",
  /** Token CA shown on the landing page. No token is live. */
  token: "",
};
export const deployment = { contractsLive: true, tokenLive: false };
export type ContractName = keyof typeof contracts;
