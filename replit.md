# Smart Fasal — Smart Agriculture Platform

## ⚡ AGENT QUICK START (Read This First — Saves Credits)

> **CRITICAL**: This project has pre-built workflows. **NEVER create new workflows.** Only restart the two that already exist. Creating duplicates causes port conflicts and wastes credits.

### The two workflows (already exist — just restart them)

| Workflow name | What it does | Port |
|---|---|---|
| `API Server` | Database push + Express API | 8080 |
| `artifacts/smart-fasal: web` | React/Vite frontend | 5000 |

The `artifacts/smart-fasal: web` workflow is **managed by the artifact system** — PORT=5000 and BASE_PATH=/ are already injected automatically. Do not override or recreate it.

### Step 1 — Install dependencies (only if `node_modules` is missing)
```bash
pnpm install
```
> On a fresh GitHub import this runs automatically via `scripts/post-merge.sh`. Only run manually if node_modules is absent.

### Step 2 — Restart workflows (never create new ones)
```
restart_workflow("API Server")
restart_workflow("artifacts/smart-fasal: web")
```

### Step 3 — Verify
- API: `curl http://localhost:8080/api/weather` → JSON weather data
- Frontend: visit `http://localhost:5000/` → Farm Dashboard visible

### Troubleshooting
| Symptom | Fix |
|---|---|
| Preview shows "app not running" | A duplicate workflow grabbed port 5000. Delete any workflow named "Start application" or "Frontend", then restart `artifacts/smart-fasal: web` |
| `drizzle-kit not found` | Run `pnpm install` from workspace root |
| Frontend blank/white | Check `artifacts/smart-fasal/vite.config.ts` — remove `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers if present |
| Port 8080 in use | Delete any duplicate API workflow; only `API Server` should run |

### Environment Variables (already set in .replit userenv)
```
ETH_WALLET_ADDRESS=0x1C9d29F655E2674665eFD84B3997c8E76F1f88Cc
OPTIMISM_RPC_URL=https://sepolia.optimism.io
STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io/rpc/v0_7
LIGHTHOUSE_API_KEY=223c00b4.ccc6a5abae6a4f65bf9391950236e7aa
```
OpenAI: uses Replit AI proxy — no key needed, just use `@workspace/integrations-openai-ai-server`.

---

## Project Overview

Full-stack mobile-style web app for Indian farmers combining:
- AI crop recommendations (OpenAI GPT via Replit AI proxy)
- IoT sensor data monitoring (NPK, pH, moisture)
- Filecoin/IPFS storage (Lighthouse SDK, real uploads)
- **Flow blockchain — 5 use cases (all with real Cadence transactions on Testnet):**
  - Season NFTs: `SmartFasal.FarmerSeasonNFT` (NonFungibleToken standard)
  - Parametric Insurance: drought/flood/frost/pest claims filed on-chain via Cadence
  - DAO Governance: voter address + proposal ID recorded on Flow Testnet per vote
  - Farm Data Oracle: IoT sensor readings (N/P/K/pH/moisture) anchored on-chain
  - Yield Token Market: future harvest tokenization (coming Season 2)
  - Expert Micropayments: 0.001 FLOW FungibleToken transfer via Cadence before consultation
- Parametric insurance risk assessment
- P2P marketplace with live mandi prices
- Community platform with expert Q&A (FLOW micropayments) and encrypted chat
- Verifiable Farmer Credit History (CIBIL-style 300–900 AI credit score)
- HyperCerts on Optimism Sepolia (impact certificates for sustainable farming)
- Zama FHE disease intelligence (private encrypted reporting)

## Flow Blockchain Architecture (Hackathon)

**Narrative**: Identity (Season NFTs) → Protection (Parametric Insurance) → Income (Expert micropayments + Yield Tokens)

**Cadence transaction pattern**: All transactions use `auth(Storage) &Account` Cadence 1.0 syntax, graceful fallback on FCL errors (never crashes the UI). Real transactions show Flowscan links; demo fallbacks use `demo-` prefix.

**Flowscan link format**: `https://testnet.flowscan.io/tx/{txId}`

**Key state managed in wallet-context.tsx**: `nfts`, `insuranceClaims`, `oracleReadings`, `expertPayments`

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS v4 + shadcn/ui
- **Charts**: Recharts
- **Data fetching**: React Query (TanStack Query)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (for API), Vite (for frontend)
- **AI**: OpenAI integration (via Replit AI proxy)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (port 8080)
│   ├── smart-fasal/        # React + Vite frontend (port 5000)
│   └── mockup-sandbox/     # Component preview server (design tool)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations/       # Shared OpenAI integration
├── scripts/
│   └── post-merge.sh       # Auto-runs on import: pnpm install + db push
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── tsconfig.json
```

## API Routes

All routes are prefixed with `/api`:

| Route | Description |
|-------|-------------|
| `GET /api/health` | Health check |
| `POST /api/sensor-data` | Submit IoT sensor reading |
| `GET /api/sensor-data` | Get latest sensor reading |
| `GET /api/sensor-data/history` | Get historical readings |
| `POST /api/ai/recommendations` | AI crop recommendations (OpenAI) |
| `POST /api/ai/disease-detect` | AI disease detection (OpenAI) |
| `GET /api/weather` | Current weather (Punjab, India) |
| `GET /api/insurance/risk` | Parametric risk assessment |
| `POST /api/insurance/claims` | Submit insurance claim |
| `GET /api/insurance/claims` | List claims |
| `GET /api/market/prices` | Live mandi prices |
| `GET /api/market/listings` | P2P listings |
| `POST /api/market/listings` | Create listing |
| `GET /api/market/recommendations` | AI product recommendations |
| `GET /api/community/posts` | Community feed |
| `POST /api/community/posts` | Create post |
| `POST /api/community/posts/:id/like` | Like a post |
| `GET /api/community/messages` | Encrypted chat messages |
| `POST /api/community/messages` | Send chat message |
| `GET /api/community/experts` | Expert directory |
| `POST /api/community/experts/:id/ask` | Ask an expert |
| `GET /api/filecoin/records` | IPFS/Filecoin storage records |
| `POST /api/filecoin/store` | Store data on Filecoin (Lighthouse) |
| `GET /api/rewards` | Farmer rewards wallet |
| `POST /api/rewards/connect-wallet` | Connect Flow wallet (+10 pts) |
| `POST /api/rewards/checkin` | Daily check-in |
| `GET /api/analytics/summary` | Analytics summary |
| `GET /api/analytics/logs` | Event logs |
| `POST /api/hypercerts/mint` | Mint HyperCert on Optimism Sepolia |
| `GET /api/hypercerts/wallet` | Check HyperCert wallet balance |
| `POST /api/disease-intel/submit` | Submit FHE-encrypted disease report |
| `GET /api/disease-intel/aggregate` | District disease heatmap |
| `GET /api/lit/vaults` | List Lit Protocol encrypted vaults |
| `POST /api/lit/encrypt` | Encrypt farm data via Lit |
| `POST /api/lit/grant` | Grant access to encrypted vault |
| `POST /api/lit/decrypt` | Decrypt farm data via Lit |

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Dashboard with live weather, NPK sensors, AI recommendations |
| Analytics | `/analytics` | Historical NPK charts, system health, event logs |
| AI Hub | `/ai` | Manual soil analysis + disease detection via OpenAI |
| Insurance | `/insurance` | Parametric risk assessment + claims |
| Market | `/market` | Mandi prices, P2P trade, Agri inputs |
| Community | `/community` | Feed, Web3 encrypted chat, Expert Q&A |
| Web3 Hub | `/web3` | Flow NFTs, HyperCerts, Filecoin, Lit Protocol, Zama FHE |
| Profile | `/profile` | Farmer credit score, history, identity |

## Database Schema

Tables: `sensor_readings`, `insurance_claims`, `market_listings`, `community_posts`, `community_messages`, `community_experts`, `filecoin_records`, `rewards_wallets`, `reward_transactions`, `event_logs`, `disease_intel_reports`

## Disease Shield — Private Multi-Farm Disease Intelligence (Zama FHE)

Real FHE feature using `fhevmjs` connected to Ethereum Sepolia testnet:
- Farmers encrypt disease scan result using `createEncryptedInput().addBool(value).encrypt()`
- WASM files in `artifacts/smart-fasal/public/`
- KMS Contract: `0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC` (Sepolia)
- ACL Contract: `0x687820221192C5B662b25367F70076A37bc79b6c` (Sepolia)
- DB table: `disease_intel_reports`
- API routes: `POST /api/disease-intel/submit`, `GET /api/disease-intel/aggregate`

## HyperCerts — IoT-Verified Impact Certificates

Real on-chain minting on Optimism Sepolia:
- Contract: `0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07`
- Metadata uploaded to IPFS via Lighthouse SDK
- Wallet: `0x1C9d29F655E2674665eFD84B3997c8E76F1f88Cc` (Optimism Sepolia)
- Needs OP Sepolia ETH to mint: https://app.optimism.io/faucet

## Key Design Decisions

- **Filecoin storage**: Real uploads via Lighthouse SDK (API key set)
- **Chat encryption**: XOR cipher + base64 (simulated E2E)
- **Flow rewards**: +10 pts wallet connect, +5 pts posts, +50 pts claims
- **Weather**: Simulated data for Punjab, India with realistic variation
- **Mandi prices**: Seeded with real Indian crop prices, dynamically fluctuated
- **Insurance risk**: LOW/MEDIUM/HIGH based on moisture (<30%) and temperature (>35°C)
- **OpenAI**: Uses Replit AI proxy — import from `@workspace/integrations-openai-ai-server`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` with `composite: true`. Always typecheck from root: `pnpm run typecheck`.

## Development Commands

```bash
pnpm install                                          # Install all dependencies
pnpm --filter @workspace/api-server run dev           # Run API server (port 8080)
pnpm --filter @workspace/smart-fasal run dev          # Run frontend (needs PORT + BASE_PATH env)
pnpm --filter @workspace/db run push-force            # Push DB schema (force, no prompt)
pnpm --filter @workspace/db run push                  # Push DB schema (interactive)
pnpm --filter @workspace/api-spec run codegen         # Regenerate API client from OpenAPI spec
pnpm run typecheck                                    # Typecheck all packages
```
