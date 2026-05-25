#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT/full"

echo "Starting VEIL sidecar on http://127.0.0.1:6010 ..."
docker compose up -d --build

echo "Health: curl http://127.0.0.1:6010/health"
