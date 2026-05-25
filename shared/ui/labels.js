export const STAGE_LABELS_KO = {
  sealed: "봉인",
  foreshadow: "복선",
  hint: "암시",
  partial: "부분 공개",
  near_reveal: "거의 공개",
  revealed: "완전 공개",
};

export const SOURCE_LABELS_KO = {
  pluginStorage: "로컬 저장",
  sidecar: "사이드카 저장",
  cache: "오프라인(로컬 캐시)",
  sample: "샘플 데이터",
  unavailable: "sidecar 대기",
};

export function stageLabelKo(stage) {
  return STAGE_LABELS_KO[stage] || stage;
}

export function sourceLabelKo(source) {
  return SOURCE_LABELS_KO[source] || source;
}

export function formatViolation(v) {
  return `[${v.secret_id}] ${v.reason}`;
}

export function riskLabelKo(level) {
  const map = {
    none: "안전",
    low: "낮음",
    medium: "보통",
    high: "높음",
    critical: "위험",
  };
  return map[level] || level;
}
