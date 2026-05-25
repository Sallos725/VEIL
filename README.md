# VEIL

**VEIL** — Visibility Enforcement & Integrity Layer

VEIL is a RisuAI JavaScript plugin for staged secret disclosure, character knowledge boundaries, persona privacy, spoiler pacing, and narrative reveal integrity.

## Editions

- **VEIL Lite** ([lite/veil-lite.js](lite/veil-lite.js)): single `.js` RisuAI plugin. No sidecar.
- **VEIL Full** ([full/plugin/veil-full.js](full/plugin/veil-full.js)): single `.js` plugin plus optional [sidecar](full/sidecar/).

Lite is mandatory. Full is optional.

## Development

```bash
npm install
npm run bundle   # lite/entry.js → lite/veil-lite.js, full/plugin/entry.js → veil-full.js
npm test
npm run sidecar  # optional HTTP helper on http://127.0.0.1:8787
```

Edit shared logic in [shared/](shared/), then run `npm run bundle` before importing plugins into RisuAI.

## RisuAI usage

1. Import `lite/veil-lite.js` (or `full/plugin/veil-full.js`) as a RisuAI plugin.
2. Use VEIL MCP tools before revealing hidden motives, backstory, persona-private facts, or plot twists.
3. If `check_disclosure` returns unsafe, revise using `get_reveal_guidance` and `redact_to_allowed_stage`.

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
| `check_sidecar_status` | reports disabled | health check |

See [AGENTS.md](AGENTS.md) for full design rules.
