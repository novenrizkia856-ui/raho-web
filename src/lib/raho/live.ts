/**
 * Live Raho client. Every value on screen is read from the chain; the only local data is the
 * PQ seed in vault.ts. Writes go through the user's RahoAccount: `execute` while it is on ECDSA,
 * `executePQ` with a fresh Lamport key once it has migrated.
 */
import {
  createPublicClient, createWalletClient, custom, defineChain, encodeFunctionData, http, isAddressEqual,
  parseEther, zeroHash, type Address, type Hex,
} from "viem";
import { chainConfig, contractAddress, contractsReady } from "../../config/index.ts";
import { postQuantumSchemes } from "../../config/schemes.ts";
import { getWallet, onWallet } from "../wallet.ts";
import { accountAbi, factoryAbi, managerAbi, MIGRATION_STATUS, registryAbi, type MigrationStatus } from "./abi.ts";
import { keyHash, publicKey, registeredKey, sign } from "./lamport.ts";
import { backupText, commitmentOf, findChain, hexToSeed, loadSeed, newSeed, parseBackup, saveSeed } from "./vault.ts";

export type Stage = "OFFLINE" | "CONNECT" | "NETWORK" | "ACCOUNT" | "KEY" | "MIGRATE" | "CREATED" | "READY" | "EXECUTED" | "VERIFIED" | "ACTIVE";

export interface MigrationRecord {
  id: Hex; account: Address; adapter: Address; currentScheme: Hex; targetScheme: Hex; keyId: Hex;
  status: MigrationStatus; createdAt: number; updatedAt: number;
}
export interface Compatibility { validAddresses: boolean; schemeEnabled: boolean; keyActive: boolean; adapterSupports: boolean }
export interface AccountState {
  address: Address; deployed: boolean; balance: bigint;
  authScheme: Hex; authKeyId: Hex; authKeyHash: Hex; pqNonce: bigint; postQuantum: boolean;
}
export interface KeyState { keyId: Hex; schemeId: Hex; commitment: Hex; registeredAt: number }
export interface LiveState {
  stage: Stage;
  loading: boolean;
  busy: string | null;
  error: string | null;
  owner: Address | null;
  account: AccountState | null;
  schemeId: Hex;
  schemeEnabled: boolean;
  key: KeyState | null;
  compatibility: Compatibility | null;
  pending: MigrationRecord | null;
  history: MigrationRecord[];
  vault: { hasSeed: boolean; backedUp: boolean; matchesKey: boolean; controlsAccount: boolean };
  lastTx: { hash: Hex; label: string } | null;
}

const SCHEME = postQuantumSchemes[0].id;
const ECDSA = "0xdd257d51d34f3ce6230fa6c519bdb92e87d983673f990241740ea874c53296c7";

export const chain = defineChain({
  id: chainConfig.chainId ?? 0,
  name: chainConfig.chainName,
  nativeCurrency: chainConfig.nativeCurrency,
  rpcUrls: { default: { http: [chainConfig.rpcUrl] } },
  blockExplorers: chainConfig.explorerUrl ? { default: { name: "Explorer", url: chainConfig.explorerUrl } } : undefined,
});
export const publicClient = createPublicClient({ chain, transport: http(chainConfig.rpcUrl || undefined) });

const addr = {
  registry: () => contractAddress("registry") as Address,
  manager: () => contractAddress("manager") as Address,
  factory: () => contractAddress("factory") as Address,
};

type Call = { target: Address; value: bigint; data: Hex };
const call = (target: Address, data: Hex, value = 0n): Call => ({ target, value, data });

const blank = (): LiveState => ({
  stage: contractsReady() ? "CONNECT" : "OFFLINE", loading: false, busy: null, error: null, owner: null, account: null,
  schemeId: SCHEME, schemeEnabled: false, key: null, compatibility: null, pending: null, history: [],
  vault: { hasSeed: false, backedUp: false, matchesKey: false, controlsAccount: false }, lastTx: null,
});

let state = blank();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const set = (next: Partial<LiveState>) => { state = { ...state, ...next }; emit(); };

export const getState = (): LiveState => state;
export function subscribe(listener: () => void): () => void { listeners.add(listener); return () => listeners.delete(listener); }

const backupFlag = (account: Address) => `raho-pq-backup:${chainConfig.chainId}:${account.toLowerCase()}`;
const readFlag = (key: string) => { try { return localStorage.getItem(key) === "1"; } catch { return false; } };

function toRecord(id: Hex, m: { account: Address; adapter: Address; currentScheme: Hex; targetScheme: Hex; keyId: Hex; status: number; createdAt: bigint; updatedAt: bigint }): MigrationRecord {
  return { ...m, id, status: MIGRATION_STATUS[m.status] ?? "NONE", createdAt: Number(m.createdAt), updatedAt: Number(m.updatedAt) };
}

function deriveStage(s: LiveState): Stage {
  const wallet = getWallet();
  if (!contractsReady()) return "OFFLINE";
  if (wallet.status !== "connected") return "CONNECT";
  if (wallet.wrongNetwork) return "NETWORK";
  if (!s.account?.deployed) return "ACCOUNT";
  const p = s.pending?.status;
  if (p === "CREATED" || p === "READY" || p === "EXECUTED" || p === "VERIFIED") return p;
  if (!s.key) return "KEY";
  if (s.account.postQuantum && s.account.authKeyId.toLowerCase() === s.key.keyId.toLowerCase()) return "ACTIVE";
  return "MIGRATE";
}

// ---------------------------------------------------------------- reads

let refreshing: Promise<void> | null = null;
export function refresh(): Promise<void> {
  refreshing ??= load().finally(() => { refreshing = null; });
  return refreshing;
}

async function load(): Promise<void> {
  const wallet = getWallet();
  if (!contractsReady() || wallet.status !== "connected" || wallet.wrongNetwork) {
    let schemeEnabled = false;
    if (contractsReady()) {
      try {
        schemeEnabled = (await publicClient.readContract({ address: addr.registry(), abi: registryAbi, functionName: "getScheme", args: [SCHEME] })).enabled;
      } catch { /* Shown as disabled until the RPC answers. */ }
    }
    set({ ...blank(), schemeEnabled, lastTx: state.lastTx, stage: deriveStage(blank()) });
    return;
  }
  set({ loading: true, error: null });
  try {
    const owner = wallet.address as Address;
    const address = await publicClient.readContract({ address: addr.factory(), abi: factoryAbi, functionName: "accountOf", args: [owner] });
    const [code, balance, scheme] = await Promise.all([
      publicClient.getCode({ address }),
      publicClient.getBalance({ address }),
      publicClient.readContract({ address: addr.registry(), abi: registryAbi, functionName: "getScheme", args: [SCHEME] }),
    ]);
    const next: Partial<LiveState> = { owner, schemeEnabled: scheme.enabled, key: null, compatibility: null, pending: null, history: [] };
    const deployed = !!code && code !== "0x";
    let account: AccountState = { address, deployed, balance, authScheme: ECDSA, authKeyId: zeroHash, authKeyHash: zeroHash, pqNonce: 0n, postQuantum: false };

    if (deployed) {
      const read = <F extends "authScheme" | "authKeyId" | "authKeyHash" | "pqNonce">(functionName: F) =>
        publicClient.readContract({ address, abi: accountAbi, functionName });
      const [authScheme, authKeyId, authKeyHash, pqNonce, active, pendingId, ids] = await Promise.all([
        read("authScheme"), read("authKeyId"), read("authKeyHash"), read("pqNonce"),
        publicClient.readContract({ address: addr.registry(), abi: registryAbi, functionName: "getActiveKey", args: [address] }),
        publicClient.readContract({ address: addr.manager(), abi: managerAbi, functionName: "pendingMigrationOf", args: [address] }),
        publicClient.readContract({ address: addr.manager(), abi: managerAbi, functionName: "getMigrationHistory", args: [address] }),
      ]);
      account = { address, deployed, balance, authScheme, authKeyId, authKeyHash, pqNonce, postQuantum: authScheme.toLowerCase() !== ECDSA };
      const [keyId, key] = active;
      if (keyId !== zeroHash) next.key = { keyId, schemeId: key.schemeId, commitment: key.keyCommitment, registeredAt: Number(key.registeredAt) };
      const records = await Promise.all(ids.map(async (id) =>
        toRecord(id, await publicClient.readContract({ address: addr.manager(), abi: managerAbi, functionName: "getMigration", args: [id] }))));
      next.history = records.reverse();
      next.pending = pendingId !== zeroHash ? next.history.find((m) => m.id === pendingId) ?? null : null;
      if (next.key) {
        next.compatibility = await publicClient.readContract({
          address: addr.manager(), abi: managerAbi, functionName: "getCompatibility", args: [address, next.key.schemeId, next.key.keyId, address],
        });
      }
    }
    next.account = account;
    next.vault = await vaultStatus(account, next.key ?? null);
    state = { ...state, ...next, loading: false };
    set({ stage: deriveStage(state) });
  } catch (error) {
    set({ loading: false, error: message(error) });
  }
}

async function vaultStatus(account: AccountState, key: KeyState | null): Promise<LiveState["vault"]> {
  const seed = loadSeed(chain.id, account.address);
  if (!seed) return { hasSeed: false, backedUp: false, matchesKey: false, controlsAccount: false };
  const matchesKey = !!key && findChain(seed, key.commitment) >= 0;
  let controlsAccount = false;
  if (account.postQuantum) {
    try { await currentPQKey(account, seed); controlsAccount = true; } catch { controlsAccount = false; }
  }
  return { hasSeed: true, backedUp: readFlag(backupFlag(account.address)), matchesKey, controlsAccount };
}

// ---------------------------------------------------------------- writes

function walletClient() {
  const provider = window.ethereum;
  if (!provider) throw new Error("No browser wallet found.");
  const wallet = getWallet();
  if (wallet.status !== "connected") throw new Error("Connect a wallet first.");
  if (wallet.wrongNetwork) throw new Error(`Switch the wallet to ${chainConfig.chainName}.`);
  return createWalletClient({ chain, transport: custom(provider), account: wallet.address as Address });
}

async function run(label: string, send: () => Promise<Hex>): Promise<Hex> {
  if (state.busy) throw new Error("Another action is still running.");
  set({ busy: label, error: null });
  try {
    const hash = await send();
    set({ lastTx: { hash, label }, busy: `${label}: confirming` });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`${label} reverted onchain.`);
    await refresh();
    return hash;
  } catch (error) {
    set({ error: message(error) });
    throw error;
  } finally {
    set({ busy: null });
  }
}

const needAccount = (): AccountState => {
  if (!state.account?.deployed) throw new Error("Create your Raho smart account first.");
  return state.account;
};
const needSeed = (account: AccountState): Hex => {
  const seed = loadSeed(chain.id, account.address);
  if (!seed) throw new Error("No PQ key in this browser. Generate one, or import your backup in Keys.");
  return seed;
};

/** The Lamport key that must sign the account's next `executePQ`. */
async function currentPQKey(account: AccountState, seed: Hex): Promise<{ chain: number; index: number }> {
  const key = await publicClient.readContract({ address: addr.registry(), abi: registryAbi, functionName: "getKey", args: [account.authKeyId] });
  const r = findChain(seed, key.keyCommitment);
  if (r < 0) throw new Error("This browser's PQ key does not control the account. Import the right backup.");
  const index = Number(account.pqNonce) + 1;
  if (keyHash(publicKey(hexToSeed(seed), r, index)).toLowerCase() !== account.authKeyHash.toLowerCase()) {
    throw new Error("PQ key position does not match the account. Import the right backup.");
  }
  return { chain: r, index };
}

/** Send `calls` as the smart account, with ECDSA or a PQ signature depending on its state. */
async function asAccount(label: string, calls: Call[]): Promise<Hex> {
  const account = needAccount();
  const owner = getWallet().address as Address;
  return run(label, async () => {
    const client = walletClient();
    if (!account.postQuantum) {
      if (!isAddressEqual(owner, (await publicClient.readContract({ address: account.address, abi: accountAbi, functionName: "owner" })))) {
        throw new Error("Only the account owner can act before migration.");
      }
      const { request } = await publicClient.simulateContract({ address: account.address, abi: accountAbi, functionName: "execute", args: [calls], account: owner });
      return client.writeContract(request);
    }
    const seed = needSeed(account);
    const { chain: r, index } = await currentPQKey(account, seed);
    const raw = hexToSeed(seed);
    const key = publicKey(raw, r, index);
    const nextKeyHash = keyHash(publicKey(raw, r, index + 1));
    const digest = await publicClient.readContract({ address: account.address, abi: accountAbi, functionName: "pqDigest", args: [calls, nextKeyHash] });
    const args = [calls, nextKeyHash, toHex(key), toHex(sign(raw, r, index, digest))] as const;
    // A signed key is spent even if a call fails, so only broadcast what simulates cleanly.
    const { result, request } = await publicClient.simulateContract({ address: account.address, abi: accountAbi, functionName: "executePQ", args, account: owner });
    if (!result) throw new Error(`${label} would fail. Nothing was sent and no key was spent.`);
    return client.writeContract(request);
  });
}

const toHex = (bytes: Uint8Array): Hex => `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;

export async function createAccount(): Promise<void> {
  await run("Create smart account", async () => {
    const owner = getWallet().address as Address;
    const { request } = await publicClient.simulateContract({ address: addr.factory(), abi: factoryAbi, functionName: "createAccount", account: owner });
    return walletClient().writeContract(request);
  });
}

/** Make a new seed for the account. Refuses to replace one that controls a migrated account. */
export function generateKey(): { backup: string } {
  const account = needAccount();
  if (account.postQuantum && state.vault.controlsAccount) throw new Error("This browser already holds the key that controls the account.");
  const seed = newSeed();
  saveSeed(chain.id, account.address, seed);
  try { localStorage.removeItem(backupFlag(account.address)); } catch { /* Ignore. */ }
  void refresh();
  return { backup: backupText(account.address, seed) };
}

export function currentBackup(): string | null {
  const account = state.account;
  const seed = account && loadSeed(chain.id, account.address);
  return account && seed ? backupText(account.address, seed) : null;
}

export function confirmBackup(): void {
  const account = needAccount();
  localStorage.setItem(backupFlag(account.address), "1");
  void refresh();
}

export function importBackup(text: string): void {
  const account = needAccount();
  const parsed = parseBackup(text);
  if (!parsed) throw new Error("That is not a Raho key backup.");
  if (!isAddressEqual(parsed.account, account.address)) throw new Error("That backup belongs to another account.");
  saveSeed(chain.id, account.address, parsed.seed);
  localStorage.setItem(backupFlag(account.address), "1");
  void refresh();
}

/** First registration chain of this seed that the registry has never seen. */
async function freshChain(account: AccountState, seed: Hex): Promise<number> {
  for (let r = 0; r < 64; r++) {
    const keyId = await publicClient.readContract({ address: addr.registry(), abi: registryAbi, functionName: "computeKeyId", args: [account.address, SCHEME, commitmentOf(seed, r)] });
    const key = await publicClient.readContract({ address: addr.registry(), abi: registryAbi, functionName: "getKey", args: [keyId] });
    if (key.status === 0) return r;
  }
  throw new Error("This seed has no unused registrations left. Generate a new key.");
}

/** Register the first PQ key, or rotate to a new one when a key already exists. */
export async function registerKey(): Promise<void> {
  const account = needAccount();
  if (!state.schemeEnabled) throw new Error("The post quantum scheme is not enabled on this deployment.");
  const seed = needSeed(account);
  if (!state.vault.backedUp) throw new Error("Confirm your key backup first.");
  if (state.pending) throw new Error("Finish or cancel the open migration first.");
  const rotate = !!state.key;
  if (rotate && state.vault.matchesKey && !account.postQuantum) throw new Error("This key is already registered.");
  const r = await freshChain(account, seed);
  const blob = registeredKey(hexToSeed(seed), r);
  const digest = await publicClient.readContract({ address: addr.registry(), abi: registryAbi, functionName: "registrationDigest", args: [account.address, SCHEME, blob] });
  const proof = toHex(sign(hexToSeed(seed), r, 0, digest));
  const data = encodeFunctionData({ abi: registryAbi, functionName: rotate ? "rotateKey" : "registerKey", args: [SCHEME, blob, proof] });
  await asAccount(rotate ? "Rotate PQ key" : "Register PQ key", [call(addr.registry(), data)]);
}

export async function createMigration(): Promise<void> {
  const key = state.key;
  if (!key) throw new Error("Register a PQ key first.");
  if (!state.vault.matchesKey) throw new Error("This browser does not hold the registered key. Import your backup first.");
  const account = needAccount();
  await asAccount("Create migration", [call(addr.manager(), encodeFunctionData({ abi: managerAbi, functionName: "createMigration", args: [key.schemeId, key.keyId, account.address] }))]);
}

const pendingId = (expected: MigrationStatus): Hex => {
  if (state.pending?.status !== expected) throw new Error("The migration is not at this step.");
  return state.pending.id;
};

export const prepareMigration = () =>
  asAccount("Prepare migration", [call(addr.manager(), encodeFunctionData({ abi: managerAbi, functionName: "prepareMigration", args: [pendingId("CREATED")] }))]).then(() => undefined);

export async function executeMigration(): Promise<void> {
  const id = pendingId("READY");
  const account = needAccount();
  const seed = needSeed(account);
  if (!state.vault.backedUp) throw new Error("Confirm your key backup first. After this step only the PQ key controls the account.");
  const r = state.key ? findChain(seed, state.key.commitment) : -1;
  if (r < 0) throw new Error("This browser does not hold the registered key.");
  const blob = registeredKey(hexToSeed(seed), r);
  await asAccount("Execute migration", [call(addr.manager(), encodeFunctionData({ abi: managerAbi, functionName: "executeMigration", args: [id, blob] }))]);
}

export const verifyMigration = () =>
  asAccount("Verify migration", [call(addr.manager(), encodeFunctionData({ abi: managerAbi, functionName: "verifyMigration", args: [pendingId("EXECUTED")] }))]).then(() => undefined);

export const activateMigration = () =>
  asAccount("Activate PQ authentication", [call(addr.manager(), encodeFunctionData({ abi: managerAbi, functionName: "activateMigration", args: [pendingId("VERIFIED")] }))]).then(() => undefined);

export async function cancelMigration(): Promise<void> {
  const id = state.pending?.id;
  if (!id) throw new Error("There is no open migration.");
  await asAccount("Cancel migration", [call(addr.manager(), encodeFunctionData({ abi: managerAbi, functionName: "cancelMigration", args: [id] }))]);
}

/** Move ETH out of the smart account. After migration this is signed with the PQ key. */
export async function sendFromAccount(to: string, amount: string): Promise<void> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(to.trim())) throw new Error("Enter a valid recipient address.");
  let value: bigint;
  try { value = parseEther(amount.trim()); } catch { throw new Error("Enter a valid ETH amount."); }
  if (value <= 0n) throw new Error("Enter an amount above zero.");
  if (state.account && value > state.account.balance) throw new Error("The account balance is too low.");
  await asAccount("Send ETH", [call(to.trim() as Address, "0x", value)]);
}

export function message(error: unknown): string {
  const e = error as { shortMessage?: string; message?: string; details?: string };
  const text = e?.shortMessage || e?.message || "Action failed.";
  if (/User (rejected|denied)/i.test(text)) return "Request declined in the wallet.";
  return text.split("\n")[0];
}

let started = false;
export function start(): void {
  if (started) return;
  started = true;
  onWallet(() => { void refresh(); });
  window.addEventListener("focus", () => { if (!state.busy) void refresh(); });
  void refresh();
}
