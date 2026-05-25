# VEIL v0.1.0-beta — Release notes

**Visibility Enforcement & Integrity Layer** — RisuAI 플러그인 베타.

| | |
|---|---|
| **버전** | `v0.1.0-beta` (`//@version 0.1.0-beta`) |
| **저장소** | https://github.com/Sallos725/VEIL |
| **상태** | 베타 — 실사용 피드백 기반 수정 예정 |

---

## 한 줄 요약

RP에서 **비밀·스포일러를 단계적으로** 드러내게 하고, **채팅 세션마다** 시크릿을 나눠 관리합니다. **모델이 호출하는 MCP 도구는 사용하지 않습니다** — RisuAI 제약상 플러그인 MCP는 RP 루프에 붙지 않으며, VEIL은 **대시보드 GUI**로 동작합니다.

---

## 에디션

| 에디션 | 파일 | 필요 조건 |
|--------|------|-----------|
| **Lite** | [lite/veil-lite.js](../lite/veil-lite.js) | RisuAI만 · `pluginStorage` |
| **Full** | [full/plugin/veil-full.js](../full/plugin/veil-full.js) | RisuAI + **sidecar 필수** |

---

## 설치 — Lite

1. RisuAI → Plugin Settings → Import  
   `https://raw.githubusercontent.com/Sallos725/VEIL/main/lite/veil-lite.js`
2. 봇·채팅 선택 후 **VEIL** 열기 (설정 메뉴 / 햄버거 / 채팅 도구)
3. 대시보드 **`v0.1.0-beta`** 칩 확인
4. **안내** 탭에서 캐릭터 카드용 프롬프트 스니펫 복사

---

## 설치 — Full (sidecar 먼저)

```bash
docker pull ghcr.io/sallos725/veil-sidecar:v0.1.0-beta
cd full
docker compose -f docker-compose.release.yml up -d
curl http://127.0.0.1:6010/health
```

1. sidecar가 떠 있는지 확인 (`health` JSON)
2. RisuAI → Import [full/plugin/veil-full.js](../full/plugin/veil-full.js)  
   `https://raw.githubusercontent.com/Sallos725/VEIL/main/full/plugin/veil-full.js`
3. 플러그인 `sidecar_url` 기본 `http://127.0.0.1:6010`
4. VEIL 대시보드 — **사이드카 연결됨** 칩이 보여야 편집·저장·스캔 가능

sidecar 없으면 Full 대시보드는 **읽기 전용 + 안내**만 표시됩니다.

---

## 대시보드 (실제 사용 경로)

| 탭 | Lite | Full |
|----|------|------|
| 시크릿 | 세션별 CRUD, cid 변환, JSON | sidecar SoT |
| 검사 | 휴리스틱 | 휴리스틱 + sidecar semantic |
| 수정 | — | redact / rewrite 가이드 |
| 가이드 | 단계별 힌트 | 동일 |
| 스캔 | 로어북·LLM(플러그인) | sidecar 스캔 |
| LLM 설정 | pluginStorage | pluginStorage |
| 안내 | 프롬프트 스니펫 | 동일 |

**MCP 도구는 등록하지 않습니다** (`get_reveal_guidance` 등은 과거 설계; Risu 모듈 전용 MCP와 별개).

---

## 알려진 제한

- 그룹 채팅 미지원
- 전역 `loreBook` 페이지 미스캔
- Risu **모듈**로 VEIL 도구 재노출 — 미구현 (향후 검토)
- redact/semantic — sidecar·LLM 설정에 의존

---

## 버그 제보

https://github.com/Sallos725/VEIL/issues — Risu 버전, Lite/Full, sidecar 여부, 대시보드 버전 칩, 재현 절차.

---

## 태그 배포

```bash
git tag v0.1.0-beta
git push origin v0.1.0-beta
```

Release 첨부: `veil-lite.js`, `veil-full.js`, `docker-compose.release.yml`, GHCR `veil-sidecar` 이미지.

---

## 문서

- [HANDOFF.md](HANDOFF.md)
- [AGENTS.md](../AGENTS.md)
