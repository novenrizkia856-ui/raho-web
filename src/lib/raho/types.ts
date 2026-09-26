export type MigrationState =
  | "NOT_STARTED" | "DETECTED" | "KEY_PREPARED" | "COMPATIBLE" | "BUILT"
  | "READY" | "SUBMITTED" | "VERIFYING" | "ACTIVE" | "FAILED";

export interface AccountInfo {
  address: string;
  network: string;
  accountType: string;
  authentication: string;
  keyType: string;
  source: "demo" | "wallet";
}

export interface PostQuantumKey {
  schemeId: string;
  publicKey: string;
  status: "prepared" | "registered";
  createdAt: string;
}

export interface CompatibilityCheck { label: string; status: "compatible" | "pending" | "action_required" | "unsupported"; }
export interface CompatibilityResult { status: "compatible" | "action_required" | "unsupported"; checks: CompatibilityCheck[]; }
export interface MigrationRequest {
  account: string;
  network: string;
  currentAuth: string;
  newAuth: string;
  publicKey: string;
  method: string;
  estimatedFee: string;
  status: "built" | "ready";
}
export interface VerificationResult { status: "demo_verified" | "pending"; checks: string[]; verifiedAt?: string; }
export interface MigrationRecord {
  id: string;
  account: string;
  network: string;
  previousAuth: string;
  newAuth: string;
  status: "demo_active";
  verification: "demo_verified";
  timestamp: string;
}
export interface RahoState {
  stage: MigrationState;
  account: AccountInfo;
  key: PostQuantumKey | null;
  compatibility: CompatibilityResult | null;
  request: MigrationRequest | null;
  verification: VerificationResult | null;
  history: MigrationRecord[];
  selectedSchemeId: string;
  rotation: { schemeId: string; status: "prepared"; createdAt: string } | null;
  error: string | null;
}
