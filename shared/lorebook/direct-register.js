import { attachChatBinding } from "../chat-binding.js";

const VALID_STAGES = new Set([
  "sealed",
  "foreshadow",
  "hint",
  "partial",
  "near_reveal",
]);

function slugId(value) {
  return String(value || "lore")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 40);
}

function activationTags(keys) {
  if (!keys) return [];
  return String(keys)
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 48)
    .slice(0, 5);
}

/**
 * Risu 로어북 항목 1개 → VEIL 시크릿 1개 (분할 없음).
 * @param {object} entry
 * @param {object} binding
 * @param {{ defaultStage?: string, existingIds?: Set<string> }} [opts]
 */
export function loreEntryToVeilSecret(entry, binding, opts = {}) {
  const defaultStage = VALID_STAGES.has(opts.defaultStage)
    ? opts.defaultStage
    : "hint";

  const title = (
    entry.loreTitle ||
    entry.source ||
    `로어 ${(entry.loreIndex ?? 0) + 1}`
  ).slice(0, 120);

  const baseId = `lore_${slugId(entry.id || `${entry.sourceLayer}_${entry.loreIndex}`)}`;
  let id = baseId;
  const existing = opts.existingIds;
  if (existing) {
    let n = 1;
    while (existing.has(id)) {
      id = `${baseId}_${n}`;
      n += 1;
    }
    existing.add(id);
  }

  const keyTags = activationTags(entry.loreKeys);
  const now = new Date().toISOString();

  const secret = {
    id,
    title,
    fullSecret: String(entry.text || "").slice(0, 4000),
    revealStage: defaultStage,
    revealLadder: {
      foreshadow: [
        entry.loreKeys
          ? `「${keyTags[0] || "관련 키워드"}」가 나올 때만 분위기·반응으로 암시한다.`
          : "해당 설정을 직접 설명하지 않고 분위기만 흘린다.",
      ],
      hint: keyTags.length
        ? [`활성 키: ${keyTags.join(", ")} — 간접 단서만 허용.`]
        : ["간접적인 단서만 허용한다."],
      partial: [],
    },
    knownBy: [],
    unknownBy: [],
    hardBlocks: keyTags.slice(0, 3),
    visibilityMode: "stage_guidance",
    tags: ["lorebook", entry.sourceLayer, ...keyTags].filter(Boolean),
    loreEntryId: entry.id,
    loreLayer: entry.sourceLayer,
    loreIndex: entry.loreIndex,
    source: entry.source,
    createdAt: now,
    updatedAt: now,
  };

  return attachChatBinding(secret, binding);
}

/**
 * @param {object[]} entries
 */
export function loreEntriesToVeilSecrets(entries, binding, opts = {}) {
  const existingIds = opts.existingIds || new Set();
  return entries.map((entry) =>
    loreEntryToVeilSecret(entry, binding, { ...opts, existingIds })
  );
}
