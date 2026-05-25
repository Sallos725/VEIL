# VEIL Lite

Single-file RisuAI JavaScript plugin (`//@name veil_lite`, API 3.0, version 0.0.1).

Import [veil-lite.js](veil-lite.js) via RisuAI Plugin Settings → Import Plugin.

After editing [entry.js](entry.js) or `shared/`, run `npm run bundle` from the repository root.

Does not require Node, Python, TypeScript, or a sidecar at runtime.

## GUI

After import, open **VEIL** from the **hamburger menu** or **chat toolbar** (시크릿 · 검사 · 가이드 · 스캔 · **LLM 설정**).

### 채팅 바인딩

VEIL은 **현재 선택된 캐릭터·채팅** (`getCurrentCharacterIndex` / `getCurrentChatIndex`)에만 시크릿을 적용합니다. 채팅 화면에서 햄버거 → VEIL을 여세요.

### 스캔 탭 (v2)

- **로어 항목 1개 = 시크릿 1개** (Risu `globalLore` / `localLore` 분할 없음)
- **직접 등록**(권장): LLM 없이 선택 항목을 그대로 VEIL 시크릿으로 등록
- **LLM 분석**(선택): 공개 단계·사다리만 외부 LLM에 제안 (Lite도 가능)

**LLM 설정** 탭 (채팅 도구 모음 → VEIL):

- 프로바이더: OpenAI, Anthropic, Vertex, Google AI Studio, Ollama Cloud, Custom
- 모델 ID 직접 입력
- Vertex: 서비스 계정 JSON 파일 가져오기 또는 붙여넣기 (저장 후 녹색 표시)
- OpenAI 호환 `/v1/chat/completions` 엔드포인트

**햄버거 메뉴**와 **채팅 도구 모음** 모두에 VEIL 버튼이 있습니다. 캐릭터·채팅을 선택한 뒤 여세요.
