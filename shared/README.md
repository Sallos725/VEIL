# Shared VEIL runtime

Plain JavaScript modules used by:

- `npm run bundle` → `lite/veil-lite.js`, `full/plugin/veil-full.js`
- `npm test` → `scripts/run-tests.mjs`

| Module | Role |
|--------|------|
| `core.js` | Reveal stages, disclosure, redact |
| `veil-service.js` | Dashboard API (no Risu MCP) |
| `ui/dashboard.js` | Primary user interface |
| `storage/pluginStore.js` | Lite secrets |
| `storage/sidecarStore.js` | Full secrets (sidecar required) |

`mcp/` is deprecated — see [mcp/README.md](mcp/README.md).

Edit here, then `npm run bundle` from the repo root.
