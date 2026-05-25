export const VEIL_STAGE_ORDER = [
  "sealed",
  "foreshadow",
  "hint",
  "partial",
  "near_reveal",
  "revealed",
];

export function getStageIndex(stage) {
  return VEIL_STAGE_ORDER.indexOf(stage);
}

export function canAdvanceTo(currentStage, newStage) {
  const currentIndex = getStageIndex(currentStage);
  const newIndex = getStageIndex(newStage);
  if (currentIndex < 0 || newIndex < 0) return false;
  return newIndex > currentIndex;
}

export function isValidStage(stage) {
  return VEIL_STAGE_ORDER.includes(stage);
}
