# Raho

Post Quantum Smart Account Migration Layer. Static Vite and TypeScript frontend.

## Run

```bash
npm ci
npm run dev
npm run check
npm run build
```

Vercel uses `vercel.json` to build static files into `dist/`. `/app` serves `app.html`.

## Migration demo

The app offers Overview, Migrate, Accounts, Keys, History, and Settings. The guided flow moves through account selection, authentication detection, key preparation, compatibility, build, review, demo execution, verification, and activation. Key rotation and history remain available after activation.

Every result is controlled local demo data and persists in the browser. Connecting a wallet reads its address only. No signing, transaction submission, cryptographic key generation, or onchain verification occurs.

## Future integration

- `src/config/chain.ts`: network details
- `src/config/contracts.ts`: separate migration and token addresses with independent deployment flags
- `src/config/schemes.ts`: extensible signature scheme descriptions
- `src/lib/raho/adapter.ts`: interface used by the UI
- `src/lib/raho/demo-adapter.ts`: current local implementation
- `src/lib/raho/contract-adapter.ts`: future implementation boundary

The landing page shows the token CA. It says Coming Soon until a valid deployed token address is configured. The copy button does not copy a placeholder or the migration contract address.
