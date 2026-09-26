import { chainConfig, contractAddress, contractsReady, deployment, explorerLink, tokenDisplay } from "../../config/index.ts";
import type { ContractAddresses } from "../../config/contracts.ts";
import { getWallet } from "../../lib/wallet.ts";
import { chip } from "../../shared/chip.ts";
import { esc } from "../../shared/dom.ts";
import type { View } from "../context.ts";

const CONTRACTS: [keyof ContractAddresses, string][] = [
  ["firewall", "Firewall"],
  ["policy", "Policy"],
  ["session", "Session"],
  ["approvals", "Approvals"],
  ["token", "Token"],
];

const value = (v: string | number | null, fallback = "Not set") =>
  v === null || v === "" ? `<span class="rh-agent__muted">${fallback}</span>` : `<span class="rh-mono">${esc(v)}</span>`;

export const settings: View = {
  title: "Settings",
  kicker: "Configuration",
  render() {
    const wallet = getWallet();
    const live = contractsReady();
    return `
      <div class="rh-settings">
        <section class="rh-card" aria-labelledby="st-net">
          <div class="rh-card__head"><h2 class="rh-card__title" id="st-net">Network</h2>${chip(live ? "ALLOW" : "none", live ? "Live" : "Not configured")}</div>
          <dl class="rh-kv">
            <div><dt>Chain</dt><dd>${value(chainConfig.chainName)}</dd></div>
            <div><dt>Chain ID</dt><dd>${value(chainConfig.chainId)}</dd></div>
            <div><dt>RPC</dt><dd>${value(chainConfig.rpcUrl)}</dd></div>
            <div><dt>Explorer</dt><dd>${value(chainConfig.explorerUrl)}</dd></div>
          </dl>
          <p class="rh-card__note">Set in <code>src/config/chain.ts</code>.</p>
        </section>

        <section class="rh-card" aria-labelledby="st-contracts">
          <div class="rh-card__head"><h2 class="rh-card__title" id="st-contracts">Contracts</h2>${chip(live ? "ALLOW" : "none", live ? "Live" : "Not deployed")}</div>
          <dl class="rh-kv">
            ${CONTRACTS.map(([key, label]) => {
              const address = key === "token" ? (tokenDisplay().live ? contractAddress("token") : "") : contractAddress(key);
              const link = address ? explorerLink("address", address) : "";
              return `<div><dt>${label}</dt><dd>${
                address
                  ? link
                    ? `<a class="rh-mono rh-addr" href="${esc(link)}" target="_blank" rel="noopener">${esc(address)}</a>`
                    : `<span class="rh-mono rh-addr">${esc(address)}</span>`
                  : `<span class="rh-agent__muted">${key === "token" ? "Coming Soon" : "Not deployed"}</span>`
              }</dd></div>`;
            }).join("")}
          </dl>
          <p class="rh-card__note">Set in <code>src/config/contracts.ts</code>. Contracts live: ${deployment.contractsLive ? "yes" : "no"}.</p>
        </section>

        <section class="rh-card" aria-labelledby="st-wallet">
          <div class="rh-card__head"><h2 class="rh-card__title" id="st-wallet">Wallet</h2>${chip(wallet.status === "connected" ? "ALLOW" : "none", wallet.status === "connected" ? "Connected" : "Not connected")}</div>
          <dl class="rh-kv">
            <div><dt>Account</dt><dd>${wallet.address ? `<span class="rh-mono rh-addr">${esc(wallet.address)}</span>` : '<span class="rh-agent__muted">None</span>'}</dd></div>
            <div><dt>Chain ID</dt><dd>${value(wallet.chainId, "Unknown")}</dd></div>
            <div><dt>Network match</dt><dd>${chainConfig.chainId === null ? '<span class="rh-agent__muted">No Raho network yet</span>' : wallet.wrongNetwork ? chip("REVIEW", "Wrong network") : chip("ALLOW", "OK")}</dd></div>
          </dl>
          <div class="rh-card__actions">
            ${
              wallet.status === "connected"
                ? `<button type="button" class="rh-btn rh-btn--sm rh-btn--ghost" data-action="disconnect-wallet">Forget account</button>`
                : `<button type="button" class="rh-btn rh-btn--sm" data-action="connect-wallet">Connect wallet</button>`
            }
          </div>
          <p class="rh-card__note">Read only. Raho never asks this page to sign.</p>
        </section>

        <section class="rh-card" aria-labelledby="st-demo">
          <div class="rh-card__head"><h2 class="rh-card__title" id="st-demo">Demo data</h2>${chip("REVIEW", "Local")}</div>
          <p class="rh-caption">Agents, policies and history live in this browser only. Nothing is signed or sent onchain.</p>
          <div class="rh-card__actions">
            <button type="button" class="rh-btn rh-btn--sm rh-btn--ghost" data-action="reset-demo">Reset demo data</button>
          </div>
        </section>
      </div>`;
  },
};
