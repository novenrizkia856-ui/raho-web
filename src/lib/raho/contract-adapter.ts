import type { RahoAdapter } from "./adapter.ts";

/** Deliberately unimplemented until contract ABI and wallet signing are defined. */
export class ContractAdapter implements RahoAdapter {
  readonly mode = "live" as const;
  private unavailable(): never { throw new Error("Contract integration is not configured yet."); }
  getState(): ReturnType<RahoAdapter["getState"]> { return this.unavailable(); }
  subscribe(): () => void { return this.unavailable(); }
  selectAccount(): ReturnType<RahoAdapter["selectAccount"]> { return this.unavailable(); }
  detectAuthentication(): ReturnType<RahoAdapter["detectAuthentication"]> { return this.unavailable(); }
  preparePostQuantumKey(): ReturnType<RahoAdapter["preparePostQuantumKey"]> { return this.unavailable(); }
  registerPostQuantumKey(): ReturnType<RahoAdapter["registerPostQuantumKey"]> { return this.unavailable(); }
  checkCompatibility(): ReturnType<RahoAdapter["checkCompatibility"]> { return this.unavailable(); }
  buildMigration(): ReturnType<RahoAdapter["buildMigration"]> { return this.unavailable(); }
  reviewMigration(): ReturnType<RahoAdapter["reviewMigration"]> { return this.unavailable(); }
  submitMigration(): ReturnType<RahoAdapter["submitMigration"]> { return this.unavailable(); }
  verifyMigration(): ReturnType<RahoAdapter["verifyMigration"]> { return this.unavailable(); }
  activatePostQuantumAuth(): ReturnType<RahoAdapter["activatePostQuantumAuth"]> { return this.unavailable(); }
  rotateKey(): ReturnType<RahoAdapter["rotateKey"]> { return this.unavailable(); }
  getMigrationStatus(): ReturnType<RahoAdapter["getMigrationStatus"]> { return this.unavailable(); }
  getMigrationHistory(): ReturnType<RahoAdapter["getMigrationHistory"]> { return this.unavailable(); }
  resetDemo(): ReturnType<RahoAdapter["resetDemo"]> { return this.unavailable(); }
}
