# VEIL Sidecar

Optional HTTP helper for **VEIL Full**. Default port: **6010**.

## Run locally (Node)

```bash
cd full/sidecar
VEIL_PORT=6010 VEIL_HOST=127.0.0.1 npm start
```

Health check: `http://127.0.0.1:6010/health`

## Run with Docker

From repository root:

```bash
# Linux / macOS
./full/sidecar/scripts/start.sh

# Windows
full\sidecar\scripts\start.bat
```

Stop:

```bash
./full/sidecar/scripts/stop.sh
# or stop.bat
```

Or use compose directly:

```bash
cd full
docker compose up -d --build
docker compose down
```

## RisuAI Full plugin

Import [../plugin/veil-full.js](../plugin/veil-full.js). Optional plugin argument:

- `sidecar_url` — default `http://127.0.0.1:6010`

Endpoints:

- `GET /health`
- `GET /secrets` — list secrets (`fullSecret` masked unless revealed)
- `PUT /secrets` — replace all secrets
- `PATCH /secrets/:id/stage` — advance reveal stage (`manual: true` required)
- `GET /secrets/export` — JSON export
- `POST /secrets/import` — JSON import
- `GET /llm/status` — Ollama / OpenAI-compatible LLM status
- `POST /semantic-check` — keyword + optional LLM assist
- `POST /lorebook/scan` — lore entries → secret proposals (LLM)
- `POST /rewrite`

Data is persisted under `VEIL_DATA_DIR` (default `/app/data/secrets.json`). Docker Compose mounts volume `veil-data`.

### LLM environment (optional)

```bash
export VEIL_LLM_BASE_URL=http://127.0.0.1:11434/v1   # Ollama local
export VEIL_LLM_MODEL=llama3.2
# export VEIL_LLM_API_KEY=...                         # cloud providers
```

Docker Compose sets `VEIL_LLM_BASE_URL=http://host.docker.internal:11434/v1` so the container can reach Ollama on the host.

RisuAI plugin arg `llm_model` overrides the model name sent in scan requests.
