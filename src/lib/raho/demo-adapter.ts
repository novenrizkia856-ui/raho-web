import { postQuantumSchemes, schemeName } from "../../config/schemes.ts";
import type { RahoAdapter } from "./adapter.ts";
import type { AccountInfo, CompatibilityResult, MigrationRecord, MigrationRequest, PostQuantumKey, RahoState, VerificationResult } from "./types.ts";

const STORAGE_KEY = "raho-migration-demo-v1";
const initial = (): RahoState => ({
  stage: "NOT_STARTED",
  account: { address: "Demo Account 01", network: "Demo Network", accountType: "Smart Account", authentication: "ECDSA", keyType: "Classical", source: "demo" },
  key: null, compatibility: null, request: null, verification: null, history: [],
  selectedSchemeId: postQuantumSchemes[0].id, rotation: null, error: null,
});

const order = ["NOT_STARTED", "DETECTED", "KEY_PREPARED", "COMPATIBLE", "BUILT", "READY", "SUBMITTED", "VERIFYING", "ACTIVE"] as const;

export class DemoAdapter implements RahoAdapter {
  readonly mode = "demo" as const;
  private state: RahoState;
  private listeners = new Set<() => void>();

  constructor(persist = true) {
    this.persist = persist;
    let stored: RahoState | null = null;
    if (persist && typeof localStorage !== "undefined") {
      try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as RahoState | null; } catch { /* Start fresh. */ }
    }
    this.state = stored?.stage && order.includes(stored.stage as typeof order[number]) ? stored : initial();
    if (this.state.stage === "VERIFYING" && !this.state.verification) this.state.stage = "SUBMITTED";
  }
  private persist: boolean;
  getState(): RahoState { return structuredClone(this.state); }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private save(): void {
    if (this.persist && typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.listeners.forEach((listener) => listener());
  }
  private require(stage: RahoState["stage"]): void {
    if (this.state.stage !== stage) throw new Error(`Complete ${stage.toLowerCase().replaceAll("_", " ")} first.`);
  }
  async selectAccount(address?: string): Promise<AccountInfo> {
    this.state = { ...initial(), history: this.state.history };
    if (address) this.state.account = { ...this.state.account, address, source: "wallet", network: "Wallet network unavailable in demo" };
    this.save();
    return this.getState().account;
  }
  async detectAuthentication(): Promise<AccountInfo> {
    this.require("NOT_STARTED");
    this.state.stage = "DETECTED";
    this.save();
    return this.getState().account;
  }
  async preparePostQuantumKey(schemeId: string): Promise<PostQuantumKey> {
    this.require("DETECTED");
    if (!postQuantumSchemes.some((s) => s.id === schemeId)) throw new Error("Choose a supported demo scheme.");
    this.state.selectedSchemeId = schemeId;
    this.state.key = { schemeId, publicKey: "Demo key reference pending registration", status: "prepared", createdAt: new Date().toISOString() };
    this.state.stage = "KEY_PREPARED";
    this.save();
    return this.getState().key!;
  }
  async registerPostQuantumKey(): Promise<PostQuantumKey> {
    this.require("KEY_PREPARED");
    // This only marks local demo readiness. No cryptographic key is generated or registered.
    return this.getState().key!;
  }
  async checkCompatibility(): Promise<CompatibilityResult> {
    this.require("KEY_PREPARED");
    const checks: CompatibilityResult["checks"] = [
      { label: "Account supported", status: "compatible" },
      { label: "Authentication detected", status: "compatible" },
      { label: "Migration module available", status: "compatible" },
      { label: "PQ key prepared", status: "compatible" },
      { label: "Network compatible", status: "compatible" },
      { label: "Migration path available", status: "compatible" },
    ];
    this.state.compatibility = { status: "compatible", checks };
    this.state.stage = "COMPATIBLE";
    this.save();
    return this.getState().compatibility!;
  }
  async buildMigration(): Promise<MigrationRequest> {
    this.require("COMPATIBLE");
    this.state.request = {
      account: this.state.account.address, network: this.state.account.network,
      currentAuth: this.state.account.authentication, newAuth: schemeName(this.state.key!.schemeId),
      publicKey: this.state.key!.publicKey, method: "Demo migration path",
      estimatedFee: "Unavailable in demo", status: "built",
    };
    this.state.stage = "BUILT";
    this.save();
    return this.getState().request!;
  }
  async reviewMigration(): Promise<MigrationRequest> {
    this.require("BUILT");
    this.state.request!.status = "ready";
    this.state.stage = "READY";
    this.save();
    return this.getState().request!;
  }
  async submitMigration(): Promise<void> {
    this.require("READY");
    this.state.stage = "SUBMITTED";
    this.save();
  }
  async verifyMigration(): Promise<VerificationResult> {
    this.require("SUBMITTED");
    this.state.stage = "VERIFYING";
    this.state.verification = {
      status: "demo_verified", verifiedAt: new Date().toISOString(),
      checks: ["Demo execution complete", "Expected demo key prepared", "New authentication selected", "Demo account state matches", "Activation available"],
    };
    this.save();
    return this.getState().verification!;
  }
  async activatePostQuantumAuth(): Promise<void> {
    this.require("VERIFYING");
    if (this.state.verification?.status !== "demo_verified") throw new Error("Run demo verification first.");
    this.state.stage = "ACTIVE";
    this.state.key!.status = "registered";
    this.state.account.authentication = schemeName(this.state.key!.schemeId);
    this.state.account.keyType = "Post Quantum";
    this.state.history.unshift({
      id: `demo-${Date.now()}`, account: this.state.account.address, network: this.state.account.network,
      previousAuth: this.state.request!.currentAuth, newAuth: this.state.request!.newAuth,
      status: "demo_active", verification: "demo_verified", timestamp: new Date().toISOString(),
    });
    this.save();
  }
  async rotateKey(schemeId: string): Promise<void> {
    this.require("ACTIVE");
    if (!postQuantumSchemes.some((s) => s.id === schemeId)) throw new Error("Choose a supported demo scheme.");
    this.state.rotation = { schemeId, status: "prepared", createdAt: new Date().toISOString() };
    this.save();
  }
  async getMigrationStatus(): Promise<RahoState> { return this.getState(); }
  async getMigrationHistory(): Promise<MigrationRecord[]> { return this.getState().history; }
  async resetDemo(): Promise<void> { this.state = initial(); this.save(); }
}
