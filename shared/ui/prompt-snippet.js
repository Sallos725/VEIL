/** Copy-paste snippets for character cards (no MCP tools). */

export const VEIL_PROMPT_SNIPPET_KO = `VEIL RP 자동 연동(안내 탭): replacer 권한 허용 시, 유저 입력과 매칭된 비밀만 메인 LLM에 단계별 힌트가 주입되고, 응답이 단계를 넘으면 자동 redact됩니다.

추가로 숨겨진 동기·미공개 과거사 등을 드러내기 전에는 VEIL 대시보드 「가이드」「검사」로 허용 단계를 확인한다.

비밀은 영구히 숨기는 것이 아니라, 암시 → 단서 → 부분 공개 → 완전 공개의 단계에 맞춰 드러낸다.`;

export const VEIL_PROMPT_SNIPPET_EN = `VEIL RP auto-link (Help tab): with replacer permission, matched secrets inject stage-appropriate hints before the main LLM request; responses that leak too much are auto-redacted.

Also use the VEIL dashboard Guide and Check tabs before revealing hidden motives, backstory, or persona-private facts.

Secrets should be foreshadowed, hinted, partially revealed, and fully revealed only when the narrative stage allows.`;

export function getPromptSnippet(lang = "ko") {
  return lang === "en" ? VEIL_PROMPT_SNIPPET_EN : VEIL_PROMPT_SNIPPET_KO;
}
