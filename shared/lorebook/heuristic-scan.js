import { normalizeProposal, makeProposalId } from "./proposals.js";

/**
 * 로어북 항목당 제안 1개 (문장 분할 없음).
 */
export function heuristicLorebookScan(entries, options = {}) {
  const defaultStage = options.default_stage || "hint";
  const proposals = [];

  for (const [index, entry] of entries.entries()) {
    const title = (entry.loreTitle || entry.source || `로어 ${index + 1}`).slice(
      0,
      120
    );
    const normalized = normalizeProposal(
      {
        id: makeProposalId(entry.id || entry.source, index),
        title,
        fullSecret: entry.text,
        revealStage: defaultStage,
        revealLadder: {
          foreshadow: ["직접 밝히지 않고 분위기·반응만 드러낸다."],
          hint: entry.loreKeys
            ? [`활성 키(${String(entry.loreKeys).slice(0, 80)}) 관련 간접 단서만.`]
            : [],
        },
        knownBy: [],
        unknownBy: [],
        tags: ["lorebook", "heuristic", entry.sourceLayer, ...(entry.tags || [])],
        confidence: "medium",
        source: entry.source,
        scopeType: "lorebook",
        scopeId: entry.sourceId,
        loreEntryId: entry.id,
      },
      index,
      defaultStage
    );
    if (normalized) proposals.push(normalized);
  }

  return {
    proposals,
    llm_used: false,
    method: "heuristic",
    count: proposals.length,
  };
}
