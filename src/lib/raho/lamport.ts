/**
 * Lamport one time signatures over keccak256, matching LamportVerifier.sol.
 *
 * Keys come from one 32 byte seed: sk[j] = keccak256(abi.encode(seed, chain, index, j)).
 * Chain `r` is one registration. Index 0 is the key registered in PQKeyRegistry; the
 * account's n th PQ signature after activation uses index n + 1.
 */
import { bytesToHex, concat, hexToBytes, keccak256, type Hex } from "viem";

export const KEY_BYTES = 16384;
export const SIGNATURE_BYTES = 8192;

const word = (value: bigint): Uint8Array => {
  const out = new Uint8Array(32);
  for (let i = 31, v = value; i >= 0; i--, v >>= 8n) out[i] = Number(v & 0xffn);
  return out;
};

function secret(seed: Uint8Array, chain: number, index: number, j: number): Uint8Array {
  const input = new Uint8Array(128);
  input.set(seed, 0);
  input.set(word(BigInt(chain)), 32);
  input.set(word(BigInt(index)), 64);
  input.set(word(BigInt(j)), 96);
  return keccak256(input, "bytes");
}

/** Public key: pk[j] = keccak256(sk[j]) for j in 0..511, 16384 bytes. */
export function publicKey(seed: Uint8Array, chain: number, index: number): Uint8Array {
  const out = new Uint8Array(KEY_BYTES);
  for (let j = 0; j < 512; j++) out.set(keccak256(secret(seed, chain, index, j), "bytes"), j * 32);
  return out;
}

/** Signature: for bit i of `message` (most significant first), reveal sk[2i + bit]. */
export function sign(seed: Uint8Array, chain: number, index: number, message: Hex): Uint8Array {
  const m = BigInt(message);
  const out = new Uint8Array(SIGNATURE_BYTES);
  for (let i = 0; i < 256; i++) {
    const bit = Number((m >> BigInt(255 - i)) & 1n);
    out.set(secret(seed, chain, index, 2 * i + bit), i * 32);
  }
  return out;
}

/** Same check LamportVerifier runs onchain. */
export function verify(message: Hex, signature: Uint8Array, key: Uint8Array): boolean {
  if (signature.length !== SIGNATURE_BYTES || key.length < KEY_BYTES) return false;
  const m = BigInt(message);
  for (let i = 0; i < 256; i++) {
    const bit = Number((m >> BigInt(255 - i)) & 1n);
    const h = keccak256(signature.subarray(i * 32, i * 32 + 32), "bytes");
    const expected = key.subarray((2 * i + bit) * 32, (2 * i + bit) * 32 + 32);
    for (let b = 0; b < 32; b++) if (h[b] !== expected[b]) return false;
  }
  return true;
}

export const keyHash = (key: Uint8Array): Hex => keccak256(key);

/** Key registered for chain `r`: index 0 followed by the hash of index 1, which starts the account chain. */
export function registeredKey(seed: Uint8Array, chain: number): Hex {
  return concat([bytesToHex(publicKey(seed, chain, 0)), keyHash(publicKey(seed, chain, 1))]);
}

export const seedFromHex = (hex: Hex): Uint8Array => hexToBytes(hex);
