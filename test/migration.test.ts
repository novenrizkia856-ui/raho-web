import assert from "node:assert/strict";
import { test } from "node:test";
import { chainConfig, tokenDisplay, contractsReady, contracts, deployment } from "../src/config/index.ts";
import { postQuantumSchemes } from "../src/config/schemes.ts";
import { DemoAdapter } from "../src/lib/raho/demo-adapter.ts";

test("deployment stays pending without a real address", () => {
  assert.equal(chainConfig.chainId, null);
  assert.equal(contracts.migration, "");
  assert.equal(contracts.token, "");
  assert.equal(deployment.contractsLive, false);
  assert.equal(deployment.tokenLive, false);
  assert.equal(contractsReady(), false);
  assert.deepEqual(tokenDisplay(), { label: "Coming Soon", copyValue: "", live: false });
});

test("demo migration requires ordered stages and records local completion", async () => {
  const demo = new DemoAdapter(false);
  demo.subscribe(() => {
    const state = demo.getState();
    if (state.stage === "VERIFYING") assert.ok(state.verification, "verification state must render atomically");
  });
  await assert.rejects(demo.buildMigration(), /Complete/);
  await demo.detectAuthentication();
  await demo.preparePostQuantumKey(postQuantumSchemes[1].id);
  assert.equal(demo.getState().key?.schemeId, postQuantumSchemes[1].id);
  await demo.checkCompatibility();
  assert.equal(demo.getState().compatibility?.checks.length, 6);
  await demo.buildMigration();
  assert.equal(demo.getState().request?.estimatedFee, "Unavailable in demo");
  await demo.reviewMigration();
  await demo.submitMigration();
  assert.equal(demo.getState().stage, "SUBMITTED");
  await demo.verifyMigration();
  await demo.activatePostQuantumAuth();
  assert.equal(demo.getState().stage, "ACTIVE");
  assert.equal(demo.getState().history.length, 1);
  assert.equal(demo.getState().history[0].verification, "demo_verified");
  await demo.rotateKey(postQuantumSchemes[0].id);
  assert.equal(demo.getState().rotation?.status, "prepared");
  await demo.resetDemo();
  assert.equal(demo.getState().stage, "NOT_STARTED");
  assert.equal(demo.getState().history.length, 0);
});
