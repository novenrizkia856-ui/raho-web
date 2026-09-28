import assert from "node:assert/strict";
import { test } from "node:test";
import { getAddress, keccak256, toBytes } from "viem";
import { chainConfig, contracts, contractsReady, tokenDisplay } from "../src/config/index.ts";
import { signatureSchemes } from "../src/config/schemes.ts";
import { KEY_BYTES, SIGNATURE_BYTES, keyHash, publicKey, registeredKey, sign, verify } from "../src/lib/raho/lamport.ts";
import { backupText, parseBackup } from "../src/lib/raho/vault.ts";

const seed = keccak256(toBytes("test seed"), "bytes");

test("deployment config is complete and the token stays pending", () => {
  assert.equal(chainConfig.chainId, 4663);
  assert.equal(contractsReady(), true);
  assert.deepEqual(tokenDisplay(), { label: "Coming Soon", copyValue: "", live: false });
});

test("scheme ids are keccak256 of their labels", () => {
  for (const scheme of signatureSchemes) assert.equal(scheme.id, keccak256(toBytes(scheme.label)));
});

test("key derivation matches the Solidity test vector", () => {
  // Same values as raho-contracts test_KeyDerivationMatchesWebApp.
  assert.equal(keccak256(registeredKey(seed, 0)), "0x5bca6e620556a836514db7df9ccc1861f81158daca7d2c6158882275f3c63857");
  assert.equal(keyHash(publicKey(seed, 0, 1)), "0x16a2effbf3ce4366672c6497677ecd53318e93a686e84b9e9111bea9b99a0bdb");
});

test("lamport signatures verify only for their message and key", () => {
  const message = keccak256(toBytes("message"));
  const key = publicKey(seed, 3, 2);
  const signature = sign(seed, 3, 2, message);
  assert.equal(key.length, KEY_BYTES);
  assert.equal(signature.length, SIGNATURE_BYTES);
  assert.equal(verify(message, signature, key), true);
  assert.equal(verify(keccak256(toBytes("other")), signature, key), false);
  assert.equal(verify(message, signature, publicKey(seed, 3, 3)), false);
});

test("backup lines round trip and reject junk", () => {
  const account = getAddress(contracts.factory);
  const hex = `0x${"ab".repeat(32)}` as const;
  assert.deepEqual(parseBackup(backupText(account, hex)), { account, seed: hex });
  assert.equal(parseBackup("not a backup"), null);
});
