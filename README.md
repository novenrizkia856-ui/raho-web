# raho-web

Static frontend for **Raho**, the firewall between AI agents and your wallet.

- `index.html` is the landing page: the architecture reference file itself, with its stylesheet kept verbatim and only the words, logo and Raho demos changed.
- `app.html` (served at `/app`) is the control center: overview, agents, policies, sessions, activity, approvals, emergency controls and settings.

Vite and TypeScript, no framework, no backend. Everything runs in the browser.

## Scripts

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck, then static build into dist/
npm run preview    # serve dist/
npm test           # policy engine and config tests
npm run audit      # copy rules: no dashes in landing copy, 15 word sentences, no stray addresses
```

## Contract configuration

Nothing is deployed yet, so every chain value is empty and the app runs on local demo data.
When the contracts ship, edit **two files only**:

| File | What goes in it |
| --- | --- |
| `src/config/chain.ts` | `chainId`, `chainName`, `rpcUrl`, `explorerUrl`, `nativeCurrency` |
| `src/config/contracts.ts` | `firewall`, `policy`, `session`, `approvals`, `token` addresses, plus the `deployment` flags |

- `deployment.tokenLive = true` with a valid `contracts.token` replaces "Coming Soon" in the landing
  page's Token Contract Address field and enables its copy button. Until then the button copies nothing.
- `deployment.contractsLive = true` makes `getRaho()` pick the contract adapter, but only once the
  chain id, RPC and the firewall, policy and session addresses are all set and well formed.

Components never read these files directly. They go through `src/config/index.ts`, which treats
anything malformed as "not deployed".

## Where contract integration plugs in

```
src/lib/raho/
  adapter.ts           RahoAdapter interface the UI talks to
  demo-adapter.ts      working local implementation, used today
  contract-adapter.ts  stub to implement against the deployed contracts
  engine.ts            deterministic policy engine: BLOCK > REVIEW > ALLOW
  selectors.ts         derived state (spend windows, sessions, pending approvals)
  index.ts             getRaho(): picks the adapter from the config
src/lib/wallet.ts      read only EIP-1193 connect, never signs
```

To go live, implement the methods in `contract-adapter.ts` (`checkPolicy`, `updatePolicy`,
`createSession`, `revokeSession`, `pauseAgent`, `approveRequest`, `rejectRequest`, `getActivity`,
`setEmergencyLock`, `resetLimits`), then flip `deployment.contractsLive`. The views and the landing
page do not change.

## Layout

```
index.html, app.html     page shells
public/                  favicon, font, boot.js (sets motion and colour mode before paint)
src/config/              chain and contract configuration
src/lib/                 domain logic and adapters, no DOM
src/shared/              DOM helpers, formatting, theme
src/landing/main.ts      landing runtime: reveal, shimmer, jump rail, menu, Drawing mode, demos
src/app/                 control center shell, actions, simulator, views/
src/styles/              tokens.css, base.css, app.css (the landing keeps its own inline stylesheet)
tools/check-copy.mjs     copy audit
test/engine.test.ts      engine, adapter and config tests
```

## Demo data

The control center seeds four agents, their policies, sessions and a few hours of history, all
evaluated by the real engine. Edits persist in `localStorage` for that browser. Settings has a
reset. No transaction is signed or sent, and no hash or address is invented.

## Deploy

Vercel picks up `vercel.json`: `npm ci`, `npm run build`, output `dist/`, clean URLs so `/app`
serves `app.html`. No environment variables are required.
