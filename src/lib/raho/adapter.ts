import type { AccountInfo, CompatibilityResult, MigrationRecord, MigrationRequest, PostQuantumKey, RahoState, VerificationResult } from "./types.ts";

/** UI boundary. Replace the demo implementation when contracts and wallet flows exist. */
export interface RahoAdapter {
  readonly mode: "demo" | "live";
  getState(): RahoState;
  subscribe(listener: () => void): () => void;
  selectAccount(address?: string): Promise<AccountInfo>;
  detectAuthentication(): Promise<AccountInfo>;
  preparePostQuantumKey(schemeId: string): Promise<PostQuantumKey>;
  registerPostQuantumKey(): Promise<PostQuantumKey>;
  checkCompatibility(): Promise<CompatibilityResult>;
  buildMigration(): Promise<MigrationRequest>;
  reviewMigration(): Promise<MigrationRequest>;
  submitMigration(): Promise<void>;
  verifyMigration(): Promise<VerificationResult>;
  activatePostQuantumAuth(): Promise<void>;
  rotateKey(schemeId: string): Promise<void>;
  getMigrationStatus(): Promise<RahoState>;
  getMigrationHistory(): Promise<MigrationRecord[]>;
  resetDemo(): Promise<void>;
}
