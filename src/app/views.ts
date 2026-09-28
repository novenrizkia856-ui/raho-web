import { formatEther, zeroHash } from "viem";
import { chainConfig, contracts, explorerLink, shortAddress } from "../config/index.ts";
import { schemeName } from "../config/schemes.ts";
import type { LiveState, Stage } from "../lib/raho/index.ts";
import { esc } from "../shared/dom.ts";

/* Line icons, drawn in the landing's stroke style. No emoji or symbol glyphs. */
const icons = {
  overview: '<path d="M3 3h6v8H3zM11 3h6v5h-6zM11 10h6v7h-6zM3 13h6v4H3z"/>',
  migrate: '<path d="M3 7h13l-3.2-3.2M17 13H4l3.2 3.2"/>',
  accounts: '<circle cx="10" cy="6.5" r="3.2"/><path d="M3.5 17c.9-3.4 3.3-5 6.5-5s5.6 1.6 6.5 5"/>',
  keys: '<circle cx="6.5" cy="13.5" r="3.5"/><path d="m9 11 7.5-7.5M13.3 6.7l2 2M15.5 4.5l1.6 1.6"/>',
  history: '<path d="M3.6 10.5a6.5 6.5 0 1 0 1.9-5.1L3.5 7.4"/><path d="M3.5 3.6v3.8h3.8M10 6.5V10l2.6 1.6"/>',
  settings: '<circle cx="10" cy="10" r="2.6"/><path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6"/>',
  out: '<path d="M6 14 14 6M7.5 6H14v6.5"/>',
  next: '<path d="M3 10h14M12 5l5 5-5 5"/>',
} as const;
export const icon = (name: keyof typeof icons, size = 18, extra = "") =>
  `<svg class="${extra}" viewBox="0 0 20 20" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${icons[name]}</svg>`;

export type Route = "overview" | "migrate" | "accounts" | "keys" | "history" | "settings";
export const routes: { id: Route; label: string }[] = [
  { id: "overview", label: "Overview" }, { id: "migrate", label: "Migrate" },
  { id: "accounts", label: "Accounts" }, { id: "keys", label: "Keys" },
  { id: "history", label: "History" }, { id: "settings", label: "Settings" },
];

const row = (label: string, value: string, tone = "") => `<div class="rm-row"><span>${esc(label)}</span><strong class="${tone}">${esc(value)}</strong></div>`;
const linkRow = (label: string, value: string, href: string) =>
  href ? `<div class="rm-row"><span>${esc(label)}</span><strong><a class="rm-ext" href="${esc(href)}" target="_blank" rel="noopener">${esc(value)} ${icon("out", 11)}</a></strong></div>` : row(label, value);
const panel = (kicker: string, title: string, content: string, extra = "") =>
  `<section class="rm-panel ${extra}"><div class="rm-panel__head"><span class="rh-kicker">${esc(kicker)}</span><h2 class="rh-subhead">${esc(title)}</h2></div>${content}</section>`;
const action = (id: string, label: string, s: LiveState, secondary = false, enabled = true) =>
  `<button type="button" class="rh-btn ${secondary ? "rh-btn--ghost" : ""}" data-flow="${id}" ${!enabled || s.busy ? "disabled" : ""}>${esc(label)} ${icon("out", 14)}</button>`;
const link = (route: Route, label: string) => `<a class="rh-btn rh-btn--ghost" href="#/${route}">${esc(label)} ${icon("out", 14)}</a>`;
const foot = (...items: string[]) => `<div class="rm-panel__foot">${items.join("")}</div>`;
const note = (text: string) => `<p class="rm-note">${esc(text)}</p>`;
const warn = (text: string) => `<p class="rm-note rm-warn">${esc(text)}</p>`;
const date = (seconds?: number) => seconds ? new Date(seconds * 1000).toLocaleString() : "Not available";
const addrLink = (label: string, address: string) => linkRow(label, shortAddress(address), explorerLink("address", address));
const eth = (wei: bigint) => `${Number(formatEther(wei)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${chainConfig.nativeCurrency.symbol}`;
const hash = (value: string) => value === zeroHash ? "None" : `${value.slice(0, 10)}…${value.slice(-6)}`;

export const authLabel = (s: LiveState) => !s.account?.deployed ? "Not created" : s.account.postQuantum ? schemeName(s.account.authScheme) : "ECDSA (owner wallet)";
export const stageLabel = (stage: Stage): string => ({
  OFFLINE: "Not configured", CONNECT: "Wallet not connected", NETWORK: "Wrong network", ACCOUNT: "No smart account",
  KEY: "PQ key needed", MIGRATE: "Ready to migrate", CREATED: "Migration created", READY: "Migration ready",
  EXECUTED: "Executed", VERIFIED: "Verified", ACTIVE: "Post quantum active",
})[stage];

export const lifecycle = ["Account", "Register Key", "Compatibility", "Create", "Prepare", "Execute", "Verify", "Activate"];
const stepIndex = (stage: Stage) => ({ OFFLINE: 0, CONNECT: 0, NETWORK: 0, ACCOUNT: 0, KEY: 1, MIGRATE: 2, CREATED: 4, READY: 5, EXECUTED: 6, VERIFIED: 7, ACTIVE: 8 })[stage];
export const progress = (s: LiveState) => {
  const index = stepIndex(s.stage);
  return `<ol class="rm-progress" aria-label="Migration lifecycle">${lifecycle.map((label, i) => `<li class="${i < index ? "is-done" : i === index ? "is-current" : ""}" ${i === index ? 'aria-current="step"' : ""}><span>${String(i + 1).padStart(2, "0")}</span><strong>${label}</strong></li>`).join("")}</ol>`;
};

function txNote(s: LiveState): string {
  if (s.busy) return `<div class="rm-signal"><span></span><strong>${esc(s.busy)}</strong></div>`;
  if (!s.lastTx) return "";
  return `<div class="rm-data">${linkRow("Last transaction", `${s.lastTx.label}: ${hash(s.lastTx.hash)}`, explorerLink("tx", s.lastTx.hash))}</div>`;
}
const errorNote = (s: LiveState) => s.error ? `<p class="rm-note rm-error" role="alert">${esc(s.error)}</p>` : "";

function gate(s: LiveState): string | null {
  if (s.stage === "OFFLINE") return panel("NETWORK", "Contracts not configured", note("This build has no Raho deployment configured."));
  if (s.stage === "CONNECT") return panel("01 / WALLET", "Connect your wallet", note(`Raho runs on ${chainConfig.chainName}. Your wallet owns the smart account and pays gas.`) + foot(action("connect", "Connect wallet", s)));
  if (s.stage === "NETWORK") return panel("01 / NETWORK", `Switch to ${chainConfig.chainName}`, note("Your wallet is on another network.") + foot(action("switch-network", `Switch to ${chainConfig.chainName}`, s)));
  return null;
}

function compatibilityChecks(s: LiveState): string {
  const c = s.compatibility;
  const checks: [string, boolean | undefined][] = [
    ["Account and adapter valid", c?.validAddresses], ["Scheme enabled", c?.schemeEnabled ?? s.schemeEnabled],
    ["PQ key active", c?.keyActive], ["Adapter supports account", c?.adapterSupports],
  ];
  return `<div class="rm-checks">${checks.map(([label, ok]) => `<div><span class="rm-check-dot ${ok ? "compatible" : ""}"></span><span>${esc(label)}</span><strong>${ok ? "Pass" : ok === false ? "Fail" : "Pending"}</strong></div>`).join("")}</div>`;
}

function keyPanel(s: LiveState): string {
  if (!s.schemeEnabled) return panel("02 / KEY", "Scheme not enabled", note("No post quantum verifier is enabled on this deployment yet."));
  if (!s.vault.hasSeed) {
    return panel("02 / KEY", "Generate your PQ key", note("The key is made in this browser from a random seed. It never leaves the device.") +
      warn("After migration this key is the only way to control the account. You must back it up.") + foot(action("generate", "Generate PQ key", s)));
  }
  if (!s.vault.backedUp) {
    return panel("02 / KEY", "Back up your key", note("Store the backup line offline before registering.") + foot(action("backup", "Show backup", s)));
  }
  return panel("02 / KEY", "Register your PQ key", `<div class="rm-auth"><div><span>Current authentication</span><strong>${esc(authLabel(s))}</strong><small>Read from the account</small></div><div class="rm-auth__arrow">${icon("next", 26)}</div><div><span>New key</span><strong>${esc(schemeName(s.schemeId))}</strong><small>Proof of possession checked onchain</small></div></div>` +
    note("Registration signs a proof with the new key. The registry verifier checks it.") + foot(action("register", "Register PQ key", s)));
}

function stagePanel(s: LiveState): string {
  const g = gate(s);
  if (g) return g;
  const a = s.account!;
  const cancel = action("cancel", "Cancel migration", s, true);
  switch (s.stage) {
    case "ACCOUNT":
      return panel("01 / ACCOUNT", "Create your smart account", note("Raho migrates a smart account. Yours is owned by the connected wallet and starts on ECDSA.") +
        `<div class="rm-data">${row("Owner wallet", shortAddress(s.owner ?? ""))}${row("Account address", a.address)}${row("Status", "Not deployed")}</div>` + foot(action("create-account", "Create smart account", s)));
    case "KEY": return keyPanel(s);
    case "MIGRATE": {
      const mismatch = !s.vault.matchesKey;
      return panel("03 / COMPATIBILITY", "Check and create", compatibilityChecks(s) +
        (mismatch ? warn("This browser does not hold the registered key. Import your backup in Keys, or rotate to a new key.") : note("The migration manager runs these checks again at every step.")) +
        foot(action("create-migration", "Create migration", s, false, !mismatch), mismatch ? link("keys", "Open keys") : ""));
    }
    case "CREATED":
      return panel("04 / PREPARE", "Prepare migration", compatibilityChecks(s) + note("Preparing moves the migration to READY once every check passes.") + foot(action("prepare", "Prepare migration", s), cancel));
    case "READY":
      return panel("05 / EXECUTE", "Confirm the transition", `<div class="rm-auth rm-auth--review"><div><span>Current authentication</span><strong>${esc(authLabel(s))}</strong></div><div class="rm-auth__arrow">${icon("next", 26)}</div><div><span>New authentication</span><strong>${esc(schemeName(s.pending!.targetScheme))}</strong></div></div>` +
        warn("Executing switches the account to the PQ key. Your wallet alone can no longer move it.") +
        (s.vault.backedUp ? "" : warn("Confirm your key backup first.")) + foot(action("execute", "Execute migration", s, false, s.vault.backedUp), cancel));
    case "EXECUTED":
      return panel("06 / VERIFY", "Verify the account", note("Raho asks the adapter which scheme and key the account now uses. It must match the migration.") +
        note("From here each action is signed with a fresh PQ key. Your wallet only relays it and pays gas.") + keyControl(s) + foot(action("verify", "Verify migration", s, false, s.vault.controlsAccount), cancel));
    case "VERIFIED":
      return panel("07 / ACTIVATE", "Activate PQ authentication", note("Activation checks the account state once more and closes the migration.") + keyControl(s) + foot(action("activate", "Activate", s, false, s.vault.controlsAccount), cancel));
    case "ACTIVE":
      return panel("08 / ACTIVE", "Post quantum authentication active", `<div class="rm-active-orb" aria-hidden="true"><span></span></div><div class="rm-data">${addrLink("Account", a.address)}${row("Authentication", schemeName(a.authScheme))}${row("Key id", hash(a.authKeyId))}${row("PQ signatures used", a.pqNonce.toString())}${row("Activated", date(s.history.find((m) => m.status === "ACTIVE")?.updatedAt))}</div>` +
        foot(link("accounts", "Use the account"), link("keys", "Manage keys")));
    default: return "";
  }
}

const keyControl = (s: LiveState) => s.vault.controlsAccount ? "" : warn("This browser does not hold the key that controls the account. Import your backup in Keys.");

function statusAside(s: LiveState): string {
  const a = s.account;
  return panel("MIGRATION STATUS", stageLabel(s.stage), `<div class="rm-data">${a ? addrLink("Account", a.address) : row("Account", "Not connected")}${row("Authentication", authLabel(s))}${row("Registry key", s.key ? hash(s.key.keyId) : "None")}${row("Browser key", s.vault.hasSeed ? (s.vault.backedUp ? "Backed up" : "Not backed up") : "None")}${row("Migration", s.pending ? `${s.pending.status}` : "None open")}</div>${txNote(s)}${errorNote(s)}`);
}

export function overview(s: LiveState): string {
  const active = s.stage === "ACTIVE";
  const a = s.account;
  return `<div class="rm-page">
    <section class="rm-hero"><span class="rh-kicker">POST QUANTUM SMART ACCOUNT MIGRATION LAYER</span><h2>${active ? "Post quantum active." : "Move accounts forward."}</h2><p>${active ? "Your account now answers to a post quantum key." : "Detect. Register. Migrate. Verify."}</p>${link("migrate", active ? "View migration" : "Start migration")}<div class="rm-hero__orbit" aria-hidden="true"><i></i><i></i><i></i></div></section>
    <div class="rm-grid rm-grid--three">
      ${panel("ACCOUNT", "Smart account", `<div class="rm-data">${row("Owner wallet", s.owner ? shortAddress(s.owner) : "Not connected")}${a ? addrLink("Account", a.address) : row("Account", "Not connected")}${row("Balance", a?.deployed ? eth(a.balance) : "Not available")}${row("Authentication", authLabel(s))}</div>`)}
      ${panel("MIGRATION", "Transition status", `<div class="rm-data">${row("State", stageLabel(s.stage), active ? "rm-positive" : "")}${row("Open migration", s.pending?.status ?? "None")}${row("Completed", String(s.history.filter((m) => m.status === "ACTIVE").length))}</div>`)}
      ${panel("KEY", "Post quantum path", `<div class="rm-data">${row("Scheme", schemeName(s.schemeId))}${row("Scheme enabled", s.schemeEnabled ? "Yes" : "No")}${row("Registry key", s.key ? hash(s.key.keyId) : "None")}${row("Browser key", s.vault.hasSeed ? "Present" : "None")}</div>`)}
    </div>${panel("LIFECYCLE", "Migration path", progress(s) + foot(link("migrate", "Open migration")), "rm-panel--wide")}</div>`;
}

export function migrate(s: LiveState): string {
  return `<div class="rm-page"><div class="rm-heading"><span class="rh-kicker">GUIDED MIGRATION / ${esc(chainConfig.chainName.toUpperCase())}</span><h2>Account to post quantum.</h2><p>Every step is a real transaction. Every state is read from the chain.</p></div>${progress(s)}<div class="rm-wizard">${stagePanel(s)}<aside class="rm-aside">${statusAside(s)}</aside></div></div>`;
}

export function accounts(s: LiveState): string {
  const g = gate(s);
  if (g) return `<div class="rm-page"><div class="rm-heading"><span class="rh-kicker">ACCOUNTS</span><h2>Authentication, visible.</h2></div>${g}</div>`;
  const a = s.account!;
  const canSend = a.deployed && (!a.postQuantum || s.vault.controlsAccount) && !s.pending;
  const send = a.deployed ? panel("SEND", a.postQuantum ? "Send with your PQ key" : "Send with your wallet", `<div class="rh-field"><label class="rh-label" for="send-to">Recipient</label><input class="rh-input rh-input--mono" id="send-to" autocomplete="off" spellcheck="false" placeholder="0x…"></div><div class="rh-field"><label class="rh-label" for="send-amount">Amount (${chainConfig.nativeCurrency.symbol})</label><input class="rh-input rh-input--mono" id="send-amount" inputmode="decimal" autocomplete="off" placeholder="0.01"></div>` +
    note(a.postQuantum ? "Signed with the next one time PQ key. Your wallet relays it and pays gas." : "Sent by your owner wallet through the account.") +
    (s.pending ? warn("Finish or cancel the open migration first.") : "") + foot(action("send", "Send", s, false, canSend))) : "";
  return `<div class="rm-page"><div class="rm-heading"><span class="rh-kicker">ACCOUNTS</span><h2>Authentication, visible.</h2><p>Read from the account itself.</p></div><div class="rm-grid rm-grid--two">${panel("SMART ACCOUNT", "Account profile", `<div class="rm-data">${addrLink("Account", a.address)}${row("Owner wallet", shortAddress(s.owner ?? ""))}${row("Deployed", a.deployed ? "Yes" : "No")}${row("Balance", eth(a.balance))}${row("Authentication", authLabel(s))}${row("Key id", hash(a.authKeyId))}${row("PQ signatures used", a.postQuantum ? a.pqNonce.toString() : "None")}</div>` +
    note(`Fund it by sending ${chainConfig.nativeCurrency.symbol} to the account address.`) + foot(a.deployed ? action("copy-account", "Copy address", s, true) : action("create-account", "Create smart account", s), link("migrate", "Open migration")))}${send}</div></div>`;
}

export function keys(s: LiveState): string {
  const g = gate(s);
  if (g) return `<div class="rm-page"><div class="rm-heading"><span class="rh-kicker">KEYS</span><h2>Register. Back up. Rotate.</h2></div>${g}</div>`;
  const a = s.account!;
  const canRotate = !!s.key && !s.pending && s.vault.backedUp && (!a.postQuantum || s.vault.controlsAccount);
  const registry = panel("REGISTRY", "Onchain PQ key", `<div class="rm-data">${row("Scheme", s.key ? schemeName(s.key.schemeId) : schemeName(s.schemeId))}${row("Key id", s.key ? hash(s.key.keyId) : "None")}${row("Commitment", s.key ? hash(s.key.commitment) : "None")}${row("Registered", date(s.key?.registeredAt))}${row("In this browser", s.vault.matchesKey ? "Yes" : "No")}</div>` +
    note(a.postQuantum ? "Rotation is signed with your current PQ key. Run a new migration afterwards to switch the account." : "Rotation replaces the key before migration.") +
    foot(action("rotate", "Rotate key", s, false, canRotate)));
  const browser = panel("THIS BROWSER", "Key backup", `<div class="rm-data">${row("Seed", s.vault.hasSeed ? "Stored locally" : "None")}${row("Backup confirmed", s.vault.backedUp ? "Yes" : "No")}${row("Controls account", a.postQuantum ? (s.vault.controlsAccount ? "Yes" : "No") : "Not migrated")}</div>` +
    warn("Anyone with the backup line controls a migrated account. Keep it offline.") +
    `<div class="rh-field"><label class="rh-label" for="import-backup">Import backup</label><input class="rh-input rh-input--mono" id="import-backup" autocomplete="off" spellcheck="false" placeholder="raho-pq-seed-v1:…"></div>` +
    foot(s.vault.hasSeed ? action("backup", "Show backup", s, true) : action("generate", "Generate PQ key", s, true, !!a.deployed), action("import", "Import", s, true), s.vault.hasSeed && !(a.postQuantum && s.vault.controlsAccount) && !s.vault.matchesKey ? action("regenerate", "Replace browser key", s, true) : ""));
  return `<div class="rm-page"><div class="rm-heading"><span class="rh-kicker">KEYS</span><h2>Register. Back up. Rotate.</h2><p>The registry stores a commitment. The seed stays with you.</p></div><div class="rm-grid rm-grid--two">${registry}${browser}</div>${errorNote(s)}</div>`;
}

export function history(s: LiveState): string {
  const records = s.history;
  return `<div class="rm-page"><div class="rm-heading"><span class="rh-kicker">HISTORY</span><h2>Migration audit trail.</h2><p>Read from the migration manager.</p></div>${panel("MIGRATION RECORDS", `${records.length} record${records.length === 1 ? "" : "s"}`, records.length ? `<div class="rm-history">${records.map((m) => `<article><div><span>MIGRATION</span><strong>${esc(hash(m.id))}</strong></div><div><span>TRANSITION</span><strong>${esc(schemeName(m.currentScheme))} ${icon("next", 13, "rm-inline-icon")} ${esc(schemeName(m.targetScheme))}</strong></div><div><span>STATUS</span><strong>${esc(m.status)}</strong></div><div><span>KEY</span><strong>${esc(hash(m.keyId))}</strong></div><div><span>CREATED</span><strong>${esc(date(m.createdAt))}</strong></div><div><span>UPDATED</span><strong>${esc(date(m.updatedAt))}</strong></div></article>`).join("")}</div>` : `<div class="rm-empty">No migration records yet.<br><span>Complete a migration to create one.</span></div>${foot(link("migrate", "Start migration"))}`)}</div>`;
}

export function settings(s: LiveState): string {
  return `<div class="rm-page"><div class="rm-heading"><span class="rh-kicker">SETTINGS</span><h2>Deployment.</h2><p>Every address below is verifiable onchain.</p></div><div class="rm-grid rm-grid--two">${panel("NETWORK", chainConfig.chainName, `<div class="rm-data">${row("Chain id", String(chainConfig.chainId ?? "None"))}${linkRow("Explorer", chainConfig.explorerUrl.replace(/^https:\/\//, ""), chainConfig.explorerUrl)}${row("RPC", chainConfig.rpcUrl.replace(/^https:\/\//, ""))}</div>`)}${panel("CONTRACTS", "Raho deployment", `<div class="rm-data">${addrLink("PQKeyRegistry", contracts.registry)}${addrLink("MigrationManager", contracts.manager)}${addrLink("RahoAccountFactory", contracts.factory)}${addrLink("LamportVerifier", contracts.verifier)}${row("PQ scheme", `${schemeName(s.schemeId)}${s.schemeEnabled ? "" : " (disabled)"}`)}</div>`)}</div>${panel("TRUST", "What Raho does and does not do", note("Raho records and verifies the account's authentication switch. The Lamport scheme is hash based and uses each key once.") + note("Security still depends on the verifier, the account contract, and the chain itself. The contracts have had no external audit."))}</div>`;
}

export const renderView = (route: Route, s: LiveState): string => ({ overview, migrate, accounts, keys, history, settings })[route](s);
