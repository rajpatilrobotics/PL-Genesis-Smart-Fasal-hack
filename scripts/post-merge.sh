#!/bin/bash
set -e

echo "=== Smart Fasal: Post-merge setup ==="
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  AGENT: DO NOT create any new workflows after this runs.  ║"
echo "║  Only restart the 2 existing ones listed below.           ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  Workflow 1: 'API Server'              → port 8080"
echo "  Workflow 2: 'artifacts/smart-fasal: web' → port 5000 (auto env)"
echo ""
echo "  NEVER create 'Start application', 'Frontend', or any other"
echo "  workflow. Duplicates cause port 5000 conflicts."
echo ""

echo "[1/3] Installing dependencies..."
pnpm install --frozen-lockfile

echo "[2/3] Pushing database schema..."
pnpm --filter @workspace/db run push-force

echo "[3/3] Pre-building API server (speeds up first start)..."
pnpm --filter @workspace/api-server run build || echo "Build skipped (non-fatal)"

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. restart_workflow('API Server')"
echo "  2. restart_workflow('artifacts/smart-fasal: web')"
echo "  3. Done — no other workflows needed."
