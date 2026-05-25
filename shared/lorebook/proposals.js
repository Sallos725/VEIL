const VALID_STAGES = new Set([
  "sealed",
  "foreshadow",
  "hint",
  "partial",
  "near_reveal",
]);

export function makeProposalId(source, index) {
  const base = String(source || "lore")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 32);
  return `proposed_${base}_${Date.now()}_${index}`;
}

export function normalizeProposal(raw, index, defaultStage) {
  if (!raw || typeof raw !== "object") return null;

  let stage = raw.revealStage || defaultStage;
  if (stage === "revealed") stage = "partial";
  if (!VALID_STAGES.has(stage)) stage = defaultStage;

  const title = String(raw.title || `제안 ${index + 1}`).slice(0, 120);
  const fullSecret = String(raw.fullSecret || "").slice(0, 2000);
  if (!fullSecret) return null;

  return {
    id: raw.id || makeProposalId(raw.source, index),
    title,
    scopeType: raw.scopeType || "world",
    scopeId: raw.scopeId || raw.sourceId || "lorebook",
    fullSecret,
    revealStage: stage,
    revealLadder: {
      foreshadow: raw.revealLadder?.foreshadow || [
        "분위기나 반응으로만 암시한다.",
      ],
      hint: raw.revealLadder?.hint || [],
      partial: raw.revealLadder?.partial || [],
    },
    knownBy: Array.isArray(raw.knownBy) ? raw.knownBy.map(String) : [],
    unknownBy: Array.isArray(raw.unknownBy) ? raw.unknownBy.map(String) : [],
    hardBlocks: Array.isArray(raw.hardBlocks)
      ? raw.hardBlocks.map(String)
      : [],
    visibilityMode: "stage_guidance",
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : ["lorebook"],
    confidence: raw.confidence || "medium",
    source: raw.source || "lorebook",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function proposalsFromLlmRaw(list, entries, defaultStage) {
  const proposals = [];
  for (const [i, raw] of (list || []).entries()) {
    const entryIndex =
      typeof raw.entryIndex === "number" ? raw.entryIndex : i;
    const entry = entries[entryIndex] || entries[i];
    const normalized = normalizeProposal(
      {
        ...raw,
        title: raw.title || entry?.loreTitle || entry?.source,
        fullSecret: raw.fullSecret || entry?.text,
        source: entry?.source || raw.source,
        sourceId: entry?.sourceId || raw.sourceId,
        scopeType: entry?.sourceType || "lorebook",
        loreEntryId: entry?.id,
      },
      i,
      defaultStage
    );
    if (normalized) proposals.push(normalized);
  }
  return proposals;
}
