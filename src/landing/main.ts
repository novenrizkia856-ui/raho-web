import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/landing.css";

import { chainConfig, contractsReady } from "../config/index.ts";
import { initContractAddress } from "../shared/contract-address.ts";
import { $ } from "../shared/dom.ts";
import { initReveal, initShimmer } from "../shared/motion.ts";
import { initModeToggle } from "../shared/theme.ts";
import { initEmergencyDemo, initReviewDemo, initSessionDemo } from "./demos.ts";
import { initFlow } from "./flow.ts";
import { initHeader } from "./header.ts";
import { initPreview } from "./preview.ts";
import { initSchematic } from "./schematic.ts";

function deploymentCopy(): void {
  if (!contractsReady()) return;
  const network = chainConfig.chainName || "mainnet";
  const status = $("[data-deploy-status]");
  if (status) status.textContent = `Contracts live on ${network}`;
  const footer = $("[data-footer-status]");
  if (footer) footer.textContent = `Raho contracts are live on ${network}.`;
}

initModeToggle();
initHeader();
initReveal();
initShimmer();
initContractAddress();
initSchematic();
initFlow();
initPreview();
initReviewDemo();
initSessionDemo();
initEmergencyDemo();
deploymentCopy();
