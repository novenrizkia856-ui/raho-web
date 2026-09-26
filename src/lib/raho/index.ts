import { contractsReady } from "../../config/index.ts";
import type { RahoAdapter } from "./adapter.ts";
import { ContractAdapter } from "./contract-adapter.ts";
import { DemoAdapter } from "./demo-adapter.ts";

let instance: RahoAdapter | undefined;
export function getRaho(): RahoAdapter {
  instance ??= contractsReady() ? new ContractAdapter() : new DemoAdapter();
  return instance;
}
export type { RahoAdapter } from "./adapter.ts";
export * from "./types.ts";
