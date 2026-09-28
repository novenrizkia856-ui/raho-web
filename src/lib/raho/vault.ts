/**
 * PQ key material. One random 32 byte seed per smart account, kept in this browser only.
 * After migration the seed is the only way to control the account, so the user must back it up.
 */
import { bytesToHex, getAddress, keccak256, type Address, type Hex } from "viem";
import { registeredKey } from "./lamport.ts";

const PREFIX = "raho-pq-seed-v1";
const storageKey = (chainId: number, account: Address) => `${PREFIX}:${chainId}:${account.toLowerCase()}`;
/** Registrations searched when matching a seed against onchain key commitments. */
export const MAX_CHAINS = 64;

export function newSeed(): Hex {
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  return bytesToHex(seed);
}

export function loadSeed(chainId: number, account: Address): Hex | null {
  try {
    const value = localStorage.getItem(storageKey(chainId, account));
    return value && /^0x[0-9a-f]{64}$/i.test(value) ? value as Hex : null;
  } catch { return null; }
}

export function saveSeed(chainId: number, account: Address, seed: Hex): void {
  localStorage.setItem(storageKey(chainId, account), seed);
}

export function forgetSeed(chainId: number, account: Address): void {
  try { localStorage.removeItem(storageKey(chainId, account)); } catch { /* Nothing stored. */ }
}

/** Backup line the user keeps offline. */
export const backupText = (account: Address, seed: Hex): string => `${PREFIX}:${getAddress(account)}:${seed}`;

export function parseBackup(text: string): { account: Address; seed: Hex } | null {
  const match = text.trim().match(/^raho-pq-seed-v1:(0x[0-9a-fA-F]{40}):(0x[0-9a-fA-F]{64})$/);
  return match ? { account: getAddress(match[1]), seed: match[2].toLowerCase() as Hex } : null;
}

const commitments = new Map<string, Hex>();
/** keccak256 of the registered key for chain `r`, cached per seed. */
export function commitmentOf(seed: Hex, chain: number): Hex {
  const id = `${seed}:${chain}`;
  let value = commitments.get(id);
  if (!value) {
    value = keccak256(registeredKey(hexToSeed(seed), chain));
    commitments.set(id, value);
  }
  return value;
}

/** Registration chain whose key hashes to `commitment`, or -1 if this seed never made it. */
export function findChain(seed: Hex, commitment: Hex): number {
  for (let r = 0; r < MAX_CHAINS; r++) if (commitmentOf(seed, r).toLowerCase() === commitment.toLowerCase()) return r;
  return -1;
}

export const hexToSeed = (seed: Hex): Uint8Array => {
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(seed.slice(2 + i * 2, 4 + i * 2), 16);
  return out;
};
