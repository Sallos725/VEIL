# VEIL — 인수인계 / HANDOFF

다음 기여자가 **바로 작업을 이어갈 수 있도록** 현재 구현 상태·명령·규칙을 정리한 문서입니다. 설계 원칙의 전체 스펙은 [AGENTS.md](../AGENTS.md)를 따릅니다.

---

## 30초 요약

| 항목 | 내용 |
|------|------|
| 제품 | RisuAI `.js` 플러그인 — 단계적 비밀 공개·스포일러 방지 |
| Lite | `lite/veil-lite.js` — GUI + `pluginStorage` (MCP 없음) |
| Full | `full/plugin/veil-full.js` — GUI + **sidecar 필수** `:6010` |
| 소스 편집 | `shared/` + `lite/entry.js` / `full/plugin/entry.js` |
| 배포 | `npm run bundle` 후 RisuAI에 `.js` import |
| GUI | 햄버거 **+** 채팅 도구 모음 → VEIL |
| 시크릿 범위 | **봇·채팅 세션** — Risu `chat.id` 있으면 `cid:chaId:chatId`, 없으면 `charIndex:chatIndex` |
| 로어북 | Risu `globalLore` / `localLore` — **항목 1개 = 시크릿 1개** |
| LLM | GUI **「LLM 설정」** 탭 — Risu 메인/보조(`runLLMModel`) 또는 OpenAI 호환 HTTP |

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
├─ AGENTS.md              # 설계 스펙 (정책·단계·GUI)
├─ docs/HANDOFF.md        # 이 파일 — 구현 현황·인수인계
├─ README.md              # 사용자용 요약
├─ package.json           # bundle / test / sidecar 스크립트
├─ scripts/bundle.mjs     # esbuild 번들
├─ shared/                # ★ 편집하는 공통 로직 (Plain JS)
│  ├─ core.js             # guidance, disclosure, redact, advance
│  ├─ chat-binding.js     # Risu 채팅 바인딩 (getDatabase 검증)
│  ├─ plugin-options.js   # GUI LLM 설정 + sidecar URL 병합
│  ├─ veil-service.js     # GUI용 API (구 MCP handlers)
│  ├─ risu-replacers.js   # RP beforeRequest 주입 + afterRequest redact
│  ├─ mcp/README.md       # MCP deprecated
│  ├─ storage/            # pluginStore, sidecarStore, llm/rp settings
│  ├─ lorebook/           # 수집·스캔·직접등록
│  ├─ llm/                # providers, risu-model-client, browser-client, google-auth(Vertex)
│  └─ ui/                 # dashboard, scan-panel, llm-settings, rp-link-panel, register
├─ lite/
│  ├─ entry.js            # 번들 입력
│  ├─ banner.txt          # Risu 메타 (sidecar_url만 선택)
│  └─ veil-lite.js        # ★ RisuAI import 대상 (generated)
├─ full/
│  ├─ plugin/entry.js, veil-full.js, banner.txt
│  └─ sidecar/            # Node HTTP helper
└─ tests/                 # npm test → scripts/run-tests.mjs
```

**편집하지 않는 것:** `lite/veil-lite.js`, `full/plugin/veil-full.js` (번들 산출물).

---

## RisuAI 연동 체크리스트

### 플러그인 로드

- API `//@api 3.0`, `//@name veil_lite` / `veil_full`
- **MCP 미사용** — `registerMCP` 호출 없음 ([shared/veil-service.js](../shared/veil-service.js)는 대시보드·sidecar용)
- **Risu V3 CSP** — 플러그인 iframe은 `connect-src 'none'`; sidecar/HTTP는 [`Risuai.nativeFetch`](https://github.com/kwaroran/RisuAI/blob/main/plugins.md) 경유 ([shared/configure-risu-fetch.js](../shared/configure-risu-fetch.js))
- `Risuai.registerSetting()` — 플러그인 설정 좌측 **VEIL Lite / Full** — [shared/ui/register.js](../shared/ui/register.js)
- `Risuai.registerButton()` — **hamburger + chat** — 동일 파일
- `//@update-url` / `//@link` — [lite/banner.txt](../lite/banner.txt), [full/plugin/banner.txt](../full/plugin/banner.txt)

### RP 자동 연동 (replacer)

플러그인 로드 시 [`shared/risu-replacers.js`](../shared/risu-replacers.js)가 `requestPluginPermission('replacer')` 후 등록:

| 단계 | API | 동작 |
|------|-----|------|
| 요청 전 | `addRisuReplacer('beforeRequest')` | 마지막 유저 메시지와 **태그·제목 매칭**된 시크릿만 `[VEIL]` system 블록 주입 (`allowed_disclosures`만, fullSecret 금지) |
| 응답 후 | `addRisuReplacer('afterRequest')` | `checkDisclosure` → unsafe 시 `redactToAllowedStage`로 **자동 완화** (동기 휴리스틱, LLM 없음) |

- 설정: `veil_rp_settings` in pluginStorage — [shared/storage/rp-settings-store.js](../shared/storage/rp-settings-store.js)
- GUI: 대시보드 **「안내」** 탭 — [shared/ui/rp-link-panel.js](../shared/ui/rp-link-panel.js) (토글·replacer 권한 요청)
- 바인딩 실패·매칭 0건·`enabled: false` → replacer no-op
- **스트리밍** 응답은 Risu 구현에 따라 `afterRequest` 타이밍이 다를 수 있음 — 수동 QA 권장

### 채팅 바인딩 (필수 UX)

1. 사용자가 **봇(캐릭터) 선택 + 채팅 화면**을 연 상태에서 VEIL 열기
2. [shared/chat-binding.js](../shared/chat-binding.js) `resolveChatBindingSafe()`:
   - `getCurrentCharacterIndex()` / `getCurrentChatIndex()` — **try/catch** (미선택 시 Risu 내부 `chatPage` 크래시)
   - `getDatabase(['characters'])`로 캐릭터·`chats[chatPage]` 검증
3. GUI는 현재 세션 `bindKey`만 사용 (`cid:…` 우선, 구데이터는 인덱스 키도 매칭)
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
- 프로바이더: **RisuAI 메인** (`mode: model`), **RisuAI 보조** (`mode: otherAx`), OpenAI, Anthropic, Vertex, Google AI Studio, Ollama Cloud, Custom
- Risu: URL·API 키·모델 ID 불필요 — [shared/llm/risu-model-client.js](../shared/llm/risu-model-client.js) `Risuai.runLLMModel({ allowPlugins: true })`
- HTTP: [shared/llm/browser-client.js](../shared/llm/browser-client.js) — sidecar/외부 API는 `nativeFetch` (CSP)
- Vertex: 서비스 계정 JSON → OAuth → OpenAI 호환 Vertex endpoint
- 로어 스캔·공개 검사·수정: Risu/HTTP LLM **플러그인 우선** → Full은 sidecar 폴백 ([shared/lorebook/run-scan.js](../shared/lorebook/run-scan.js), [shared/veil-service.js](../shared/veil-service.js))

---

## GUI 탭

| 탭 | Lite | Full |
|----|------|------|
| 시크릿 | CRUD, cid, JSON | sidecar SoT (오프라인 시 읽기 전용) |
| 검사 | 휴리스틱 | + sidecar semantic |
| 수정 | — | redact / rewrite |
| 가이드 | reveal guidance | 동일 |
| 스캔 | 플러그인 LLM·휴리스틱 | sidecar 스캔 |
| LLM 설정 | pluginStorage | pluginStorage |
| 안내 | RP 연동 토글 + 스니펫 | 동일 |

캐릭터 카드 스니펫: [shared/ui/prompt-snippet.js](../shared/ui/prompt-snippet.js) — replacer 자동 연동 + 대시보드 가이드/검사 안내.

---

## Full sidecar (필수)

- 기본 URL: `http://127.0.0.1:6010`
- `GET /health`, `PUT/GET /secrets`, `POST /lorebook/scan`, `POST /semantic-check`, `POST /rewrite`
- Docker: [full/docker-compose.yml](../full/docker-compose.yml) 또는 Release `docker-compose.release.yml`
- **오프라인**: 대시보드 게이트 — 편집·저장·스캔 비활성, 캐시 읽기 + Docker 안내만 ([shared/storage/sidecarStore.js](../shared/storage/sidecarStore.js))

---

## 완료된 마일스톤 (프로토타입)

- [x] Lite/Full `.js` 플러그인 + GUI (MCP 제거, v0.1.0-beta 피벗)
- [x] reveal stage + hardBlocks + knowledge boundary
- [x] pluginStorage (Lite) / sidecar SoT (Full)
- [x] GUI 대시보드 (한국어)
- [x] 채팅 바인딩 + 안전한 Risu API 호출
- [x] 로어북 1:1 수집·직접 등록
- [x] GUI LLM 프로바이더 설정
- [x] sidecar lorebook scan + semantic check (선택)
- [x] **RP replacer** — beforeRequest 가이드 주입 + afterRequest redact
- [x] `npm test` green

---

## 알려진 제한 / 다음 작업 후보

```text
- 그룹 채팅(character.type === 'group') 미지원
- 앱 전역 db.loreBook 페이지 미스캔 (캐릭터 globalLore만)
- Vertex 토큰: 브라우저에서 JWT 교환 (서비스 계정 JSON)
- Risu 모듈 경유 모델 도구 연동 — 미구현 (대신 **replacer**로 RP 억제·주입)
- RP replacer: 화자/청자는 1차 `binding.characterId`만 — 대시보드 저장값 연동은 후속
- 스트리밍·의미적 누출: afterRequest는 휴리스틱 redact만 (semantic LLM opt-in 후속)
- GUI에서 시크릿 **새로 만들기**(빈 폼)는 미구현 — import·스캔·샘플 위주
- redact/semantic: sidecar·LLM 실패 시 플러그인 휴리스틱만
```

우선순위 제안:

1. 시크릿 CRUD UI (현재 채팅 한정)
2. 그룹 채팅 / 전역 loreBook 지원 여부 결정
3. Risu 모듈 패키지로 VEIL 도구 재노출 검토 (선택)
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

## Releases

- 베타 릴리스 노트: [docs/RELEASE-v0.1.0-beta.md](RELEASE-v0.1.0-beta.md)
- 버전 상수: [shared/plugin-meta.js](../shared/plugin-meta.js) → `npm run version:sync <ver>` → `npm run bundle`
- 대시보드 헤더 **v0.1.0-beta** 칩으로 로드 버전 확인

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
4. `node scripts/prepare-release-assets.mjs <tag>` → `dist/release/`:
   - `veil-lite-<tag>.js`, `veil-full-<tag>.js`
   - `veil-sidecar-<tag>.zip` (sidecar + 최소 `shared/` + ZIP 내 compose)
   - `docker-compose-<tag>.yml`

Sidecar 배포 예:

```bash
docker pull ghcr.io/sallos725/veil-sidecar:v0.0.1
# Release ZIP: unzip 후 cd full && docker compose up -d
# 또는 docker-compose-v0.0.1.yml
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
