# Raho

Post Quantum Smart Account Migration Layer. Static Vite and TypeScript frontend, live on
Robinhood Chain mainnet (4663).

## Run

```bash
npm ci
npm run dev
npm run check
npm run build
```

Vercel uses `vercel.json` to build static files into `dist/`. `/app` serves `app.html`.

## The app

Overview, Migrate, Accounts, Keys, History and Settings. Every value on screen is read from the chain.
Every button sends a real transaction from the connected wallet.

1. **Account.** The wallet creates its `RahoAccount` through `RahoAccountFactory` (one per owner).
2. **Key.** A random 32 byte seed is made in the browser. The user must confirm an offline backup line
   (`raho-pq-seed-v1:<account>:<seed>`) before anything is registered.
3. **Register.** `registerKey` with a Lamport proof of possession, sent by the owner through `execute`.
4. **Compatibility, create, prepare.** Read from `getCompatibility`, then `createMigration` and `prepareMigration`.
5. **Execute.** `executeMigration` switches the account to the PQ key. The owner's ECDSA path closes.
6. **Verify, activate.** Signed with the next one time Lamport key through `executePQ`. The wallet only relays and pays gas.
7. **Use.** Accounts sends ETH with a PQ signature. Keys rotates the key (then run a new migration),
   shows the backup, and imports a backup in another browser.

PQ transactions are simulated before the wallet is asked. A valid signature spends its key even if a
call fails, so nothing is broadcast unless it will succeed.

## Code

- `src/config/chain.ts`: network. `VITE_RAHO_RPC_URL` overrides the RPC for local rehearsals.
- `src/config/contracts.ts`: deployed addresses, from `raho-contracts/deployments/4663.json`.
- `src/config/schemes.ts`: scheme ids (`keccak256` of the label).
- `src/lib/raho/live.ts`: chain reads, stage, and every write.
- `src/lib/raho/lamport.ts`: Lamport keys and signatures, identical to `LamportVerifier.sol`.
- `src/lib/raho/vault.ts`: seed storage, backup lines, registration matching.
- `src/lib/wallet.ts`: EIP-1193 connect, silent reconnect, network switch.
- `test/raho.test.ts`: config, scheme ids, Lamport, and a key vector shared with the contract tests.

## Rehearse against a fork

```bash
anvil --fork-url https://rpc.mainnet.chain.robinhood.com --port 8546
```

```bash
printf 'VITE_RAHO_RPC_URL=http://127.0.0.1:8546\n' > .env.fork && npx vite --mode fork
```

## Limits

Losing the seed after migration loses the account. The seed lives in this browser's `localStorage`
until the user removes it. The contracts have had no external audit. See `raho-contracts/SECURITY.md`.

The landing page shows the token CA. It says Coming Soon until a valid deployed token address is configured.
