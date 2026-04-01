# Smart Fasal — Smart Agriculture Platform

## Project Overview

Full-stack mobile-style web app for Indian farmers combining:
- AI crop recommendations (OpenAI GPT)
- IoT sensor data monitoring (NPK, pH, moisture)
- Filecoin/IPFS storage simulation
- Flow blockchain reward points
- Parametric insurance risk assessment
- P2P marketplace with live mandi prices
- Community platform with expert Q&A and encrypted chat

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
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
│   ├── smart-fasal/        # React + Vite frontend (main app)
│   └── mockup-sandbox/     # Component preview server (design tool)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
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
| `POST /api/filecoin/store` | Store data on Filecoin (simulated) |
| `GET /api/rewards` | Farmer rewards wallet |
| `POST /api/rewards/connect-wallet` | Connect Flow wallet (+10 pts) |
| `POST /api/rewards/checkin` | Daily check-in |
| `GET /api/analytics/summary` | Analytics summary |
| `GET /api/analytics/logs` | Event logs |

## Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Dashboard with live weather, NPK sensors, AI recommendations, Filecoin |
| Analytics | `/analytics` | Historical NPK charts, system health, event logs |
| AI Hub | `/ai` | Manual soil analysis + disease detection via OpenAI |
| Insurance | `/insurance` | Parametric risk assessment + claims |
| Market | `/market` | Mandi prices, P2P trade, Agri inputs |
| Community | `/community` | Feed, Web3 encrypted chat, Expert Q&A |

## Database Schema

Tables: `sensor_readings`, `insurance_claims`, `market_listings`, `community_posts`, `community_messages`, `community_experts`, `filecoin_records`, `rewards_wallets`, `reward_transactions`, `event_logs`

## Key Design Decisions

- **Filecoin storage**: Simulated with SHA-256 CID generation + ipfs.io URLs
- **Chat encryption**: Simulated with XOR cipher + base64
- **Flow rewards**: +10 pts for wallet connect, +5 pts for posts, +50 pts for claims
- **Weather**: Simulated data for Punjab, India with realistic variation
- **Mandi prices**: Seeded with real-world Indian crop prices, dynamically fluctuated
- **Insurance risk**: LOW/MEDIUM/HIGH based on moisture (<30%) and temperature (>35°C) thresholds

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. Always typecheck from root: `pnpm run typecheck`.

## Development Commands

- `pnpm --filter @workspace/api-server run dev` — Run API server
- `pnpm --filter @workspace/smart-fasal run dev` — Run frontend
- `pnpm --filter @workspace/db run push` — Push DB schema changes
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API client
- `pnpm run typecheck` — Typecheck all packages
