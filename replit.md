# Smart Fasal — Smart Agriculture Platform

## ⚡ AGENT QUICK START (Read This First — Saves Credits)

When imported fresh, run these steps **in order** without exploration:

### Step 1 — Install dependencies (if node_modules missing)
```bash
pnpm install
```

### Step 2 — Start workflows (if not already running)
The project needs **two** workflows running simultaneously:

**Workflow 1 — API Server** (console output, port 8080):
```
pnpm --filter @workspace/db run push-force && PORT=8080 pnpm --filter @workspace/api-server run dev
```

**Workflow 2 — Frontend** (webview output, port 5000):
```
pnpm --filter @workspace/smart-fasal run dev
```
With env: `PORT=5000`, `BASE_PATH=/`

### Step 3 — Verify it works
- API: `curl http://localhost:8080/api/weather` → should return JSON
- Frontend: visit `http://localhost:5000/` → Farm Dashboard

### Known Issues & Fixes
- If port 8080 conflict: only ONE workflow should run the API server. Remove any duplicate "Start application" workflow.
- If frontend shows blank: remove headers `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` from `artifacts/smart-fasal/vite.config.ts`
- If `drizzle-kit not found`: run `pnpm install` from workspace root first

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
- Flow blockchain reward points (FCL testnet)
- Parametric insurance risk assessment
- P2P marketplace with live mandi prices
- Community platform with expert Q&A and encrypted chat
- Verifiable Farmer Credit History (CIBIL-style 300–900 AI credit score)
- HyperCerts on Optimism Sepolia (impact certificates for sustainable farming)
- Zama FHE disease intelligence (private encrypted reporting)

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

## Starknet USDC Escrow — P2P Trade Payments

Real Web3 escrow flow for P2P produce trade. Replaces Filecoin FVM escrow:
- **Live USDC/INR rate**: Fetched from CoinGecko free API every 10 min
- **USDC token (Starknet Sepolia)**: `0x053b40a647cedfca6ca84f542a0fe36736031905a9639a7f19a3c1e66bfd5080` (6 decimals)
- **Oracle/escrow address**: `0x17ecda611fa4c7f75758f669a2cf0a0d1091032b1e3172bc9f293f462818d9c`
- **Cairo contract**: `contracts/smart-fasal-escrow/src/lib.cairo` (deploy with Scarb + starknet-deploy)
- **API routes**: `/api/market/escrow/rate`, `/api/market/escrow/:id/init`, `/api/market/escrow/:id/confirm-payment`, `/api/market/escrow/:id/release`
- **Frontend**: 3-step dialog in market.tsx — price breakdown → payment instructions → tx hash submit
- **DB columns added**: `buyer_wallet`, `starknet_tx_hash`, `release_tx_hash`, `usdc_amount`, `escrow_id`
- **Explorer**: https://sepolia.voyager.online

### Marketplace — Real Data
- **FPO listings**: NAFED, Sahyadri, Lasalgaon, Wayanad, Mithila Makhana, etc. (market.ts)
- **Brand products**: IFFCO, Bayer, Syngenta, UPL, Coromandel, Jain Irrigation, NSC (market.ts)
- **Live mandi prices**: DATA_GOV_IN_API_KEY → AGMARKNET API → real arrival-date prices

## Key Design Decisions

- **Starknet escrow**: Backend-oracle pattern — oracle wallet holds USDC, releases on delivery confirmation
- **Filecoin storage**: Real uploads via Lighthouse SDK (API key set)
- **Chat encryption**: XOR cipher + base64 (simulated E2E)
- **Flow rewards**: +10 pts wallet connect, +5 pts posts, +50 pts claims
- **Weather**: Simulated data for Punjab, India with realistic variation
- **Mandi prices**: Live from AGMARKNET (DATA_GOV_IN_API_KEY) or seeded fallback
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
