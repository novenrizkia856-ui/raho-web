/**
 * Contract adapter: where the deployed Raho contracts get wired in.
 *
 * It is intentionally not implemented. Every method throws until the
 * contracts exist, and `index.ts` never selects this adapter while
 * `deployment.contractsLive` is false. Addresses and the RPC come from
 * `src/config`, never from here.
 *
 * Suggested mapping, to be confirmed against the final contract ABI:
 *   checkPolicy     firewall.evaluate(wallet, agent, tx)      read, then record
 *   createPolicy    policy.setPolicy(agent, policy)            owner write
 *   updatePolicy    policy.setPolicy(agent, policy)            owner write
 *   createSession   session.createSession(agent, scope, expiry) owner write
 *   revokeSession   session.revokeSession(sessionId)           owner write
 *   pauseAgent      firewall.pauseAgent(agent)                 owner write
 *   approveRequest  approvals.approve(requestId)               owner write
 *   rejectRequest   approvals.reject(requestId)                owner write
 *   getActivity     firewall decision events, filtered by agent and time
 *   emergencyLock   firewall.emergencyLock(wallet)             owner write
 */
import type { RahoAdapter } from "./adapter.ts";
import type { RahoState } from "./types.ts";

export class ContractsNotDeployedError extends Error {
  constructor(method: string) {
    super(`Raho contracts are not deployed yet (${method}).`);
    this.name = "ContractsNotDeployedError";
  }
}

const notDeployed = (method: string) => (): never => {
  throw new ContractsNotDeployedError(method);
};

const EMPTY: RahoState = { agents: [], policies: {}, sessions: [], activity: [], locked: false };

export class ContractAdapter implements RahoAdapter {
  readonly mode = "contract" as const;
  getState = () => EMPTY;
  subscribe = () => () => {};
  previewPolicy = notDeployed("previewPolicy");
  checkPolicy = notDeployed("checkPolicy");
  createPolicy = notDeployed("createPolicy");
  updatePolicy = notDeployed("updatePolicy");
  createSession = notDeployed("createSession");
  revokeSession = notDeployed("revokeSession");
  pauseAgent = notDeployed("pauseAgent");
  resumeAgent = notDeployed("resumeAgent");
  approveRequest = notDeployed("approveRequest");
  rejectRequest = notDeployed("rejectRequest");
  getActivity = notDeployed("getActivity");
  setEmergencyLock = notDeployed("setEmergencyLock");
  resetLimits = notDeployed("resetLimits");
}
