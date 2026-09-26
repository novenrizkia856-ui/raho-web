/** Addresses stay empty until each deployment is real. */
export const contracts = { migration: "", token: "" };
export const deployment = { contractsLive: false, tokenLive: false };
export type ContractName = keyof typeof contracts;
