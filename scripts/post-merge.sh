#!/bin/bash
set -e

echo "=== Smart Fasal: Post-merge setup ==="

echo "[1/3] Installing dependencies..."
pnpm install --frozen-lockfile

echo "[2/3] Pushing database schema..."
pnpm --filter @workspace/db run push-force

echo "[3/3] Pre-building API server (speeds up first workflow start)..."
pnpm --filter @workspace/api-server run build || echo "Build skipped (non-fatal)"

echo "=== Setup complete. Workflows will start automatically. ==="
echo ""
echo "Expected workflows:"
echo "  - artifacts/api-server: API Server  → port 8080"
echo "  - artifacts/smart-fasal: web        → port 5000"
