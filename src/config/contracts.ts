/**
 * Raho contract addresses and deployment switches.
 *
 * Every address is an empty string until the contract is actually deployed.
 * Do not put placeholder or example addresses here: an empty string is what
 * tells the UI to show "Not deployed" or "Coming Soon" instead.
 */
export interface ContractAddresses {
  /** Entry point the agent integration calls to evaluate a request. */
  firewall: string;
  /** Stores owner policies: assets, contracts, functions, recipients, limits. */
  policy: string;
  /** Issues and revokes time bound agent sessions. */
  session: string;
  /** Records human approvals bound to a specific request. */
  approvals: string;
  /** Raho token. Only shown on the landing page once it exists. */
  token: string;
}

export const contracts: ContractAddresses = {
  firewall: "",
  policy: "",
  session: "",
  approvals: "",
  token: "",
};

export interface DeploymentFlags {
  /**
   * Switches the app from the local demo adapter to the contract adapter.
   * Leave false until `chain.ts` and the addresses above are filled in.
   */
  contractsLive: boolean;
  /** Shows the token address on the landing page and enables copy. */
  tokenLive: boolean;
}

export const deployment: DeploymentFlags = {
  contractsLive: false,
  tokenLive: false,
};

/** Text shown in the Token Contract Address field while no token exists. */
export const TOKEN_PENDING_LABEL = "Coming Soon";
