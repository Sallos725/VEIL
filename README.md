# VEIL

**VEIL** — Visibility Enforcement & Integrity Layer

RisuAI JavaScript plugin for staged secret disclosure, knowledge boundaries, and spoiler pacing.

**Uses the dashboard GUI, not Risu plugin MCP tools** (Risu exposes model-callable MCP mainly through Risu modules).

| Doc | Audience |
|-----|----------|
| [AGENTS.md](AGENTS.md) | Design spec, reveal stages, GUI + sidecar |
| [docs/HANDOFF.md](docs/HANDOFF.md) | **Contributors:** layout, commands, what's done |
| [docs/RELEASE-v0.1.0-beta.md](docs/RELEASE-v0.1.0-beta.md) | **Beta install** |

## Editions

| Edition | Plugin | Sidecar |
|---------|--------|---------|
| **Lite** | [lite/veil-lite.js](lite/veil-lite.js) | Not required (`pluginStorage`) |
| **Full** | [full/plugin/veil-full.js](full/plugin/veil-full.js) | **Required** — [sidecar](full/sidecar/) on port **6010** |

## Development

```bash
npm install
npm run bundle
npm test
npm run sidecar   # Full — http://127.0.0.1:6010
```

Edit [shared/](shared/) and `lite/entry.js` / `full/plugin/entry.js`; run `npm run bundle` before Risu import.

## RisuAI — Lite

1. Import `veil-lite.js` from Plugin Settings (see [RELEASE](docs/RELEASE-v0.1.0-beta.md)).
2. Select character + chat, open **VEIL** (settings sidebar / hamburger / chat toolbar).
3. Tabs: 시크릿 · 검사 · 가이드 · 스캔 · LLM 설정 · **안내** (prompt snippet).

## RisuAI — Full

1. Start sidecar first:

```bash
docker pull ghcr.io/sallos725/veil-sidecar:v0.1.0-beta
cd full && docker compose -f docker-compose.release.yml up -d
```

2. Import `veil-full.js`, confirm dashboard shows **사이드카 연결됨**.
3. Extra tab: **수정** (redact with sidecar `/rewrite`).

If sidecar is offline, Full dashboard is **read-only** with setup instructions.

## Storage

| Edition | Secrets |
|---------|---------|
| Lite | `pluginStorage` |
| Full | Sidecar `secrets.json` (volume `veil-data`) |

## API layer

Dashboard and sidecar integration: [shared/veil-service.js](shared/veil-service.js)  
Core rules: [shared/core.js](shared/core.js)

Legacy MCP tool names in old docs map to `veil-service` functions; `registerMCP` is not called.
