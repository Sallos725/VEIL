# VEIL — Releases

| Version | Doc | Notes |
|---------|-----|--------|
| **v0.1.0-beta** | [RELEASE-v0.1.0-beta.md](RELEASE-v0.1.0-beta.md) | Current beta; public feedback |

Publishing: push tag `v*` → [`.github/workflows/release.yml`](../.github/workflows/release.yml).

Version source of truth for plugins: [shared/plugin-meta.js](../shared/plugin-meta.js) → `npm run version:sync <ver>` → banners → `npm run bundle`.
