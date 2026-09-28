import { parseAbi } from "viem";

/** Fragments of raho-contracts/abi/*.json that the app calls. */
export const registryAbi = parseAbi([
  "struct PQKey { address account; bytes32 schemeId; bytes32 keyCommitment; uint8 status; uint64 registeredAt; }",
  "struct Scheme { address verifier; bool enabled; }",
  "function registerKey(bytes32 schemeId, bytes publicKey, bytes proof) returns (bytes32)",
  "function rotateKey(bytes32 schemeId, bytes publicKey, bytes proof) returns (bytes32)",
  "function getActiveKey(address account) view returns (bytes32 keyId, PQKey key)",
  "function getKey(bytes32 keyId) view returns (PQKey)",
  "function getScheme(bytes32 schemeId) view returns (Scheme)",
  "function registrationDigest(address account, bytes32 schemeId, bytes publicKey) view returns (bytes32)",
  "function computeKeyId(address account, bytes32 schemeId, bytes32 keyCommitment) pure returns (bytes32)",
]);

export const managerAbi = parseAbi([
  "struct Migration { address account; address adapter; bytes32 currentScheme; bytes32 targetScheme; bytes32 keyId; uint8 status; uint64 createdAt; uint64 updatedAt; }",
  "struct Compatibility { bool validAddresses; bool schemeEnabled; bool keyActive; bool adapterSupports; }",
  "function createMigration(bytes32 targetScheme, bytes32 keyId, address adapter) returns (bytes32)",
  "function prepareMigration(bytes32 migrationId)",
  "function executeMigration(bytes32 migrationId, bytes publicKey)",
  "function verifyMigration(bytes32 migrationId)",
  "function activateMigration(bytes32 migrationId)",
  "function cancelMigration(bytes32 migrationId)",
  "function getMigration(bytes32 migrationId) view returns (Migration)",
  "function getMigrationHistory(address account) view returns (bytes32[])",
  "function getCompatibility(address account, bytes32 targetScheme, bytes32 keyId, address adapter) view returns (Compatibility)",
  "function pendingMigrationOf(address account) view returns (bytes32)",
  "function nonces(address account) view returns (uint256)",
]);

export const factoryAbi = parseAbi([
  "function createAccount() returns (address)",
  "function accountOf(address owner) view returns (address)",
]);

export const accountAbi = parseAbi([
  "struct Call { address target; uint256 value; bytes data; }",
  "function execute(Call[] calls) payable returns (bytes[])",
  "function executePQ(Call[] calls, bytes32 nextKeyHash, bytes publicKey, bytes signature) returns (bool)",
  "function pqDigest(Call[] calls, bytes32 nextKeyHash) view returns (bytes32)",
  "function owner() view returns (address)",
  "function authScheme() view returns (bytes32)",
  "function authKeyId() view returns (bytes32)",
  "function authKeyHash() view returns (bytes32)",
  "function pqNonce() view returns (uint256)",
]);

/** Onchain MigrationStatus enum. */
export const MIGRATION_STATUS = ["NONE", "CREATED", "READY", "EXECUTED", "VERIFIED", "ACTIVE", "CANCELLED"] as const;
export type MigrationStatus = typeof MIGRATION_STATUS[number];
