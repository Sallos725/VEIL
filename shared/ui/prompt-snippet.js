/** Copy-paste snippets for character cards (no MCP tools). */

export const VEIL_PROMPT_SNIPPET_KO = `숨겨진 동기, 미공개 과거사, 페르소나 비밀, 미래 반전, OOC/비공개 메모, 현재 화자가 알 수 없는 정보를 드러내기 전에, RisuAI 메뉴에서 VEIL 대시보드를 열고 「가이드」「검사」 탭으로 허용 단계를 확인한다.

VEIL 검사 결과가 unsafe이면 해당 초안을 그대로 출력하지 않고, 허용된 공개 단계에 맞게 수정한다.

비밀은 영구히 숨기는 것이 아니라, 암시 → 단서 → 부분 공개 → 완전 공개의 단계에 맞춰 드러낸다.`;

export const VEIL_PROMPT_SNIPPET_EN = `Before revealing hidden motives, unrevealed backstory, persona-private facts, plot twists, or OOC notes, open the VEIL dashboard in RisuAI and use the Guide and Check tabs for the allowed reveal stage.

If VEIL Check reports unsafe, revise the draft to match the allowed stage instead of outputting the unsafe text.

Secrets should be foreshadowed, hinted, partially revealed, and fully revealed only when the narrative stage allows.`;

export function getPromptSnippet(lang = "ko") {
  return lang === "en" ? VEIL_PROMPT_SNIPPET_EN : VEIL_PROMPT_SNIPPET_KO;
}
