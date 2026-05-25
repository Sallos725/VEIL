# VEIL — 인수인계 / HANDOFF

다음 기여자가 **바로 작업을 이어갈 수 있도록** 현재 구현 상태·명령·규칙을 정리한 문서입니다. 설계 원칙의 전체 스펙은 [AGENTS.md](../AGENTS.md)를 따릅니다.

---

## 30초 요약

| 항목 | 내용 |
|------|------|
| 제품 | RisuAI `.js` 플러그인 — 단계적 비밀 공개·스포일러 방지 |
| Lite | `lite/veil-lite.js` — sidecar 없이 동작 |
| Full | `full/plugin/veil-full.js` + 선택 sidecar `:6010` |
| 소스 편집 | `shared/` + `lite/entry.js` / `full/plugin/entry.js` |
| 배포 | `npm run bundle` 후 RisuAI에 `.js` import |
| GUI | 햄버거 **+** 채팅 도구 모음 → VEIL |
| 시크릿 범위 | **봇·채팅 세션** — Risu `chat.id` 있으면 `cid:chaId:chatId`, 없으면 `charIndex:chatIndex` |
| 로어북 | Risu `globalLore` / `localLore` — **항목 1개 = 시크릿 1개** |
| LLM | GUI **「LLM 설정」** 탭 (pluginStorage), OpenAI 호환 API |

---

## 매일 쓰는 명령

```bash
cd /path/to/VEIL
npm install
npm run bundle    # shared → lite/veil-lite.js, full/plugin/veil-full.js
npm test          # Node test runner, 40+ tests
npm run sidecar   # Full optional, http://127.0.0.1:6010
```

RisuAI에서 플러그인 import **전에** 반드시 `bundle` 실행.

---

## 저장소 레이아웃 (실제)

```text
VEIL/
├─ AGENTS.md              # 설계 스펙 (정책·MCP·단계 정의)
├─ docs/HANDOFF.md        # 이 파일 — 구현 현황·인수인계
├─ README.md              # 사용자용 요약
├─ package.json           # bundle / test / sidecar 스크립트
├─ scripts/bundle.mjs     # esbuild 번들
├─ shared/                # ★ 편집하는 공통 로직 (Plain JS)
│  ├─ core.js             # guidance, disclosure, redact, advance
│  ├─ chat-binding.js     # Risu 채팅 바인딩 (getDatabase 검증)
│  ├─ plugin-options.js   # GUI LLM 설정 + sidecar URL 병합
│  ├─ mcp/handlers.js     # MCP tool dispatch
│  ├─ mcp/tools.js        # tool 스키마
│  ├─ storage/            # pluginStore, sidecarStore, llmSettingsStore
│  ├─ lorebook/           # 수집·스캔·직접등록
│  ├─ llm/                # providers, browser-client, google-auth(Vertex)
│  └─ ui/                 # dashboard, scan-panel, llm-settings, register
├─ lite/
│  ├─ entry.js            # 번들 입력
│  ├─ banner.txt          # Risu 메타 (sidecar_url만 선택)
│  └─ veil-lite.js        # ★ RisuAI import 대상 (generated)
├─ full/
│  ├─ plugin/entry.js, veil-full.js, banner.txt
│  └─ sidecar/            # Node HTTP helper
└─ tests/                 # node --test tests/**/*.test.js
```

**편집하지 않는 것:** `lite/veil-lite.js`, `full/plugin/veil-full.js` (번들 산출물).

---

## RisuAI 연동 체크리스트

### 플러그인 로드

- API `//@api 3.0`, `//@name veil_lite` / `veil_full`
- `Risuai.registerMCP()` — [shared/mcp/handlers.js](../shared/mcp/handlers.js)
- `Risuai.registerSetting()` — 플러그인 설정 좌측 **VEIL Lite / Full** — [shared/ui/register.js](../shared/ui/register.js)
- `Risuai.registerButton()` — **hamburger + chat** — 동일 파일
- `//@update-url` / `//@link` — [lite/banner.txt](../lite/banner.txt), [full/plugin/banner.txt](../full/plugin/banner.txt)

### 채팅 바인딩 (필수 UX)

1. 사용자가 **봇(캐릭터) 선택 + 채팅 화면**을 연 상태에서 VEIL 열기
2. [shared/chat-binding.js](../shared/chat-binding.js) `resolveChatBindingSafe()`:
   - `getCurrentCharacterIndex()` / `getCurrentChatIndex()` — **try/catch** (미선택 시 Risu 내부 `chatPage` 크래시)
   - `getDatabase(['characters'])`로 캐릭터·`chats[chatPage]` 검증
3. MCP·GUI는 현재 세션 `bindKey`만 사용 (`cid:…` 우선, 구데이터는 인덱스 키도 매칭)
4. 시크릿 탭: **세션 선택**, 제목 수정·삭제·세션 전체 삭제·**cid 키 일괄 변환** ([shared/chat-migration.js](../shared/chat-migration.js))
5. **이 세션보내기 / 이 세션 가져오기** — [shared/storage/session-secrets.js](../shared/storage/session-secrets.js) (`veilSessionExport` JSON). 전체 JSON은 모든 봇·세션 포함.
6. 카드 **「상세 편집」** — [shared/ui/secret-editor.js](../shared/ui/secret-editor.js): fullSecret, revealLadder, knownBy, hardBlocks, tags

### 로어북 (RisuAI 데이터 모델)

| Risu 필드 | VEIL 수집 |
|-----------|-----------|
| `character.globalLore[]` | 캐릭터 로어 (항목당 1행) |
| `chat.localLore[]` | 현재 채팅 로어 |
| `firstMessage`, `desc` | 스캔 탭에서 **제외** |

수집: [shared/lorebook/collectFromDatabase.js](../shared/lorebook/collectFromDatabase.js)  
등록: [shared/lorebook/direct-register.js](../shared/lorebook/direct-register.js) — LLM 없이 1:1 권장

### LLM 설정 (GUI, plugin args 아님)

- 탭: 대시보드 **「LLM 설정」** — [shared/ui/llm-settings-panel.js](../shared/ui/llm-settings-panel.js)
- 저장 키: `veil_llm_settings` in pluginStorage — [shared/storage/llmSettingsStore.js](../shared/storage/llmSettingsStore.js)
- 프로바이더: OpenAI, Anthropic, Vertex, Google AI Studio, Ollama Cloud, Custom
- Vertex: 서비스 계정 JSON 파일/붙여넣기 → OAuth 토큰 → OpenAI 호환 Vertex endpoint
- 호출: [shared/llm/browser-client.js](../shared/llm/browser-client.js) `POST {baseUrl}/chat/completions`

---

## GUI 탭

| 탭 | 역할 |
|----|------|
| 시크릿 | 세션 선택·cid 변환·**이 세션** JSON import/export·상세 편집 |
| 검사 | 초안 disclosure check |
| 가이드 | 입력 키워드 → reveal guidance |
| 스캔 | 로어북 불러오기 → 직접 등록 / LLM 분석 |
| LLM 설정 | 프로바이더·모델·키·Vertex JSON |

---

## MCP 도구

Lite·Full 공통: `get_reveal_guidance`, `check_disclosure`, `redact_to_allowed_stage`, `advance_reveal_stage`, `list_active_secrets`, `check_sidecar_status`

- `advance_reveal_stage`: **`manual: true` 필수**
- `list_active_secrets`: 현재 `bindKey`에 해당하는 시크릿만
- 바인딩 실패 시 JSON에 `binding_required`, `user_message` (한국어)

---

## Full sidecar

- 기본 URL: `http://127.0.0.1:6010`
- `GET /health`, `PUT/GET /secrets`, `POST /lorebook/scan`, `POST /semantic-check`, `POST /rewrite`
- Docker: [full/docker-compose.yml](../full/docker-compose.yml), volume `veil-data`
- 오프라인 시 plugin cache + Lite 로직으로 degrade

---

## 완료된 마일스톤 (프로토타입)

- [x] Lite/Full `.js` 플러그인 + MCP
- [x] reveal stage + hardBlocks + knowledge boundary
- [x] pluginStorage (Lite) / sidecar SoT (Full)
- [x] GUI 대시보드 (한국어)
- [x] 채팅 바인딩 + 안전한 Risu API 호출
- [x] 로어북 1:1 수집·직접 등록
- [x] GUI LLM 프로바이더 설정
- [x] sidecar lorebook scan + semantic check (선택)
- [x] `npm test` green

---

## 알려진 제한 / 다음 작업 후보

```text
- 그룹 채팅(character.type === 'group') 미지원
- 앱 전역 db.loreBook 페이지 미스캔 (캐릭터 globalLore만)
- Vertex 토큰: 브라우저에서 JWT 교환 (서비스 계정 JSON)
- MCP에 bind_key 자동 주입은 Risu가 호출 시 넣어줘야 함 (플러그인은 resolveChatBindingSafe로 보완)
- 시크릿 편집 UI (추가/삭제 폼) 미구현 — import·스캔·샘플 위주
- redact/semantic: sidecar·LLM 실패 시 플러그인 휴리스틱만
```

우선순위 제안:

1. 시크릿 CRUD UI (현재 채팅 한정)
2. 그룹 채팅 / 전역 loreBook 지원 여부 결정
3. MCP 호출 시 Risu hook으로 scene context 자동 채우기 (가능 시)
4. E2E: RisuAI 수동 QA 체크리스트 → `docs/QA-RISUAI.md`

---

## 커밋 규칙 (이후 기여)

작은 단위로 논리별 커밋:

```text
feat(shared): ...
feat(full): ...
feat(ui): ...
feat(lorebook): ...
feat(llm): ...
docs: ...
chore: bundle ...
```

`npm run bundle` 변경이 있으면 같은 PR/커밋에 `veil-lite.js` / `veil-full.js` 포함.

---

## GitHub Releases (Actions)

**`v`로 시작하는 태그**를 push하면 [`.github/workflows/release.yml`](../.github/workflows/release.yml)만 실행됩니다 (예: `v0.0.1`). `main` push만으로는 릴리스되지 않습니다.

```bash
# 버전 올린 뒤 태그 생성·푸시
git tag v0.0.1
git push origin v0.0.1
```

워크플로 순서:

1. 태그에서 버전 추출 → `scripts/sync-version.mjs`가 `package.json`, `lite/banner.txt`, `full/plugin/banner.txt` 동기화
2. `npm run bundle` → `npm test`
3. **GHCR**에 sidecar 이미지 push: `ghcr.io/sallos725/veil-sidecar:<tag>` (+ semver, `latest`)
4. GitHub Release 첨부:
   - `lite/veil-lite.js`, `full/plugin/veil-full.js`
   - `full/docker-compose.release.yml` (위 이미지 고정, `docker compose up`용)

Sidecar 배포 예:

```bash
docker pull ghcr.io/sallos725/veil-sidecar:v0.0.1
cd full && docker compose -f docker-compose.release.yml up -d
```

로컬에서 이미지 빌드: 저장소 루트에서 `docker build -f full/sidecar/Dockerfile .`

첫 GHCR push 후 [Packages](https://github.com/users/Sallos725/packages)에서 패키지 공개 범위(Public) 확인.

RisuAI **초록 + 업데이트**는 `//@update-url` (raw `main` 브랜치) + `//@version` 비교. 저장소: [https://github.com/Sallos725/VEIL](https://github.com/Sallos725/VEIL).

| 에디션 | update-url |
|--------|------------|
| Lite | `https://raw.githubusercontent.com/Sallos725/VEIL/main/lite/veil-lite.js` |
| Full | `https://raw.githubusercontent.com/Sallos725/VEIL/main/full/plugin/veil-full.js` |

`main`에 번들이 반영되어 있어야 Risu가 raw URL로 최신을 받을 수 있습니다. 태그 릴리스 후 `main`에 banner/번들 버전을 맞춰 merge·push하는 것을 권장합니다.

일반 CI: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — `main` push / PR.

---

## 문의 시 볼 파일

| 질문 | 파일 |
|------|------|
| 단계·hardBlocks 정책 | `shared/core.js`, `AGENTS.md` |
| Risu 크래시/바인딩 | `shared/chat-binding.js` |
| 로어북 안 보임 | `shared/lorebook/collectFromDatabase.js` |
| LLM 안 됨 | `shared/ui/llm-settings-panel.js`, `shared/llm/browser-client.js` |
| 버튼 안 보임 | `shared/ui/register.js` (hamburger+chat) |
| sidecar | `full/sidecar/src/server.js` |

---

## 연락처 / 맥락

프로젝트 모토: *Hide the truth. Leave the trail. Reveal with timing.*

VEIL은 **비밀을 영구히 숨기지 않고**, RP에서 **때가 되면 드러나게** 하는 레이어입니다.
