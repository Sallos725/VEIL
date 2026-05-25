#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT/full/sidecar"

mkdir -p data
export VEIL_PORT="${VEIL_PORT:-6010}"
export VEIL_HOST="${VEIL_HOST:-127.0.0.1}"
export VEIL_DATA_DIR="${VEIL_DATA_DIR:-$ROOT/full/sidecar/data}"

echo "VEIL sidecar (Node) http://${VEIL_HOST}:${VEIL_PORT}"
exec node src/server.js
