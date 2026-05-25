# VEIL

**VEIL** — Visibility Enforcement & Integrity Layer

RisuAI JavaScript plugin for staged secret disclosure, knowledge boundaries, and spoiler pacing.

| Doc | Audience |
|-----|----------|
| [AGENTS.md](AGENTS.md) | Design spec, MCP contracts, reveal stages |
| [docs/HANDOFF.md](docs/HANDOFF.md) | **Contributors:** layout, commands, what's done, what's next |
| [docs/RELEASE-v0.1.0-beta.md](docs/RELEASE-v0.1.0-beta.md) | **Beta install** and known limits |

## Editions

- **Lite** — [lite/veil-lite.js](lite/veil-lite.js): no sidecar required.
- **Full** — [full/plugin/veil-full.js](full/plugin/veil-full.js): optional [sidecar](full/sidecar/) on port **6010**.

## Development

```bash
npm install
npm run bundle   # shared → lite/veil-lite.js, full/plugin/veil-full.js
npm test
npm run sidecar  # optional
```

Edit [shared/](shared/) and edition `entry.js` files; **do not** hand-edit bundled `.js` except after bundle.

### Releases

Push a tag **`v*`** (e.g. `v0.0.1`) to run GitHub Actions: bundle, test, publish **`ghcr.io/sallos725/veil-sidecar:<tag>`**, and attach plugins + `docker-compose.release.yml` to a Release. See [docs/HANDOFF.md](docs/HANDOFF.md#github-releases-actions).

Plugin repo: [https://github.com/Sallos725/VEIL](https://github.com/Sallos725/VEIL)

## RisuAI usage

1. `npm run bundle`, then import `veil-lite.js` or `veil-full.js` in Plugin Settings.
2. Select a **character and chat**, then open **VEIL** from the **hamburger menu** or **chat toolbar**.
3. Tabs: 시크릿 · 검사 · 가이드 · 스캔 · **LLM 설정**.
4. Secrets are scoped per **chat session** (`cid:chaId:chat.id` when Risu assigns `chat.id`). Use the secrets tab to switch sessions, edit, export/import, or migrate legacy index keys.

### Lorebook scan

- Loads Risu **`globalLore`** + current chat **`localLore`** (one entry = one secret).
- Prefer **직접 등록**; optional LLM analysis from **LLM 설정** tab.

### LLM

Configure in the dashboard **LLM 설정** tab (saved to pluginStorage). Providers: OpenAI, Anthropic, Vertex (service account JSON), Google AI Studio, Ollama Cloud, Custom — OpenAI-compatible `/v1/chat/completions`.

### Storage

| Edition | Secrets |
|---------|---------|
| Lite | `pluginStorage` |
| Full | Sidecar `secrets.json` (volume `veil-data`), cache fallback |

Full + Docker: [full/sidecar/scripts/start.sh](full/sidecar/scripts/start.sh)

### Prompt snippet (Korean)

```text
숨겨진 동기, 미공개 과거사, 페르소나 비밀, 미래 반전, OOC/비공개 메모, 현재 화자가 알 수 없는 정보를 드러내기 전에는 VEIL 도구를 사용한다.

VEIL이 unsafe를 반환하면 해당 초안을 그대로 출력하지 않고, 허용된 공개 단계와 안전한 지침에 맞게 수정한다.

비밀은 영구히 숨기는 것이 아니라, 암시 → 단서 → 부분 공개 → 완전 공개의 단계에 맞춰 드러낸다.
```

## MCP tools

| Tool | Lite | Full |
|------|------|------|
| `get_reveal_guidance` | yes | yes |
| `check_disclosure` | yes | yes (+ optional sidecar) |
| `redact_to_allowed_stage` | yes | yes (+ optional sidecar) |
| `advance_reveal_stage` | yes | yes |
| `list_active_secrets` | yes | yes |
| `check_sidecar_status` | yes | yes |

See [AGENTS.md](AGENTS.md) for full design rules.
