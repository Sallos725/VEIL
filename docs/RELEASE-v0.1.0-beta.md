# VEIL v0.1.0-beta — Release notes

**Visibility Enforcement & Integrity Layer** — RisuAI 플러그인 베타.

| | |
|---|---|
| **버전** | `v0.1.0-beta` (`//@version 0.1.0-beta`) |
| **저장소** | https://github.com/Sallos725/VEIL |
| **상태** | 베타 — 실사용 피드백 기반 수정 예정 |

---

## 한 줄 요약

RP에서 **비밀·스포일러를 단계적으로** 드러내게 하고, **채팅 세션마다** 시크릿을 나눠 관리하는 RisuAI 플러그인입니다.

---

## 포함 에디션

| 에디션 | 파일 | 필요 조건 |
|--------|------|-----------|
| **Lite** | [lite/veil-lite.js](../lite/veil-lite.js) | RisuAI만 (sidecar 불필요) |
| **Full** | [full/plugin/veil-full.js](../full/plugin/veil-full.js) | RisuAI + 선택 [sidecar](../full/sidecar/) |

---

## 설치 (RisuAI)

1. 저장소 `main`에 번들이 올라가 있는지 확인 (또는 GitHub Release 첨부 파일 사용).
2. RisuAI → **Plugin Settings** → Import:
   - Lite: `https://raw.githubusercontent.com/Sallos725/VEIL/main/lite/veil-lite.js`
   - Full: `https://raw.githubusercontent.com/Sallos725/VEIL/main/full/plugin/veil-full.js`
3. **봇(캐릭터) 선택 + 채팅 화면**을 연 뒤, 설정 좌측 **VEIL Lite/Full** 또는 햄버거/채팅 도구 **VEIL** 실행.
4. 대시보드 헤더에 **`v0.1.0-beta`** 칩이 보이면 로드된 버전이 맞습니다.

### 업데이트 (초록 +)

배너에 `//@update-url`이 있으면 RisuAI 플러그인 목록에서 원격 버전이 더 크면 **Plus(초록 +)** 로 갱신됩니다. `main`의 raw URL과 `//@version`이 일치해야 합니다.

---

## Full sidecar (선택)

```bash
# Release 태그 push 후 (예: v0.1.0-beta)
docker pull ghcr.io/sallos725/veil-sidecar:v0.1.0-beta
cd full
docker compose -f docker-compose.release.yml up -d
```

로컬 개발 빌드: 저장소 루트에서 `docker build -f full/sidecar/Dockerfile .`

플러그인 `sidecar_url` 기본: `http://127.0.0.1:6010` — health: `GET /health`

---

## 이 베타에서 할 수 있는 것

- **MCP**: `get_reveal_guidance`, `check_disclosure`, `redact_to_allowed_stage`, `advance_reveal_stage`, `list_active_secrets` (+ Full: `check_sidecar_status`)
- **채팅 세션 바인딩**: Risu `chat.id` → `cid:chaId:chatId` (없으면 인덱스 키 + **cid 변환** 버튼)
- **시크릿 탭**: 세션 선택, 상세 편집, 삭제, 세션별 JSON export/import, 전체 JSON backup
- **로어북**: `globalLore` / `localLore` 수집, 항목 1:1 직접 등록, LLM 스캔(설정 시)
- **LLM 설정 탭**: OpenAI 호환 API, Vertex, Ollama Cloud 등 (pluginStorage)

---

## 알려진 제한 (베타)

- **그룹 채팅** (`character.type === 'group'`) 미지원
- 앱 전역 **loreBook** 페이지 미스캔 (캐릭터 `globalLore` + 현재 채팅 `localLore`만)
- MCP 호출 시 scene/bind 키는 Risu가 넣어주지 않으면 플러그인이 **현재 선택 채팅**으로 보완
- redact / semantic은 실패 시 **휴리스틱** 위주
- 공식 QA 체크리스트 없음 — **이슈·재현 절차로** 수정 예정

---

## 버그 제보 시 넣어 주면 좋은 정보

1. RisuAI 버전 / OS  
2. Lite vs Full, sidecar 사용 여부  
3. 대시보드에 보이는 **버전 칩** (`v0.1.0-beta`)  
4. 봇 이름, 채팅 세션(대략), 재현 1~2문장  
5. 가능하면 `fullSecret`을 가린 시크릿 JSON 또는 스크린샷  

GitHub Issues: https://github.com/Sallos725/VEIL/issues

---

## GitHub Release 게시 시 (태그 검토 후)

```bash
git tag v0.1.0-beta
git push origin v0.1.0-beta
```

Actions가 플러그인 번들·sidecar 이미지·Release 첨부를 생성합니다.  
Release 본문에는 이 파일 내용을 복사하거나 `generate_release_notes`와 병행하면 됩니다.

---

## 관련 문서

- [HANDOFF.md](HANDOFF.md) — 개발·구조
- [AGENTS.md](../AGENTS.md) — 설계 스펙
- [README.md](../README.md) — 사용자 요약
