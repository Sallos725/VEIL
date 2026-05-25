import { llmLorebookScan, getLlmConfig } from "./llm-client.js";
import { proposalsFromLlmRaw } from "../../../shared/lorebook/proposals.js";

export async function scanLorebookEntries(body) {
  const entries = body.entries || [];
  const options = body.options || {};
  const defaultStage = options.default_stage || "foreshadow";
  const llmOverrides = body.llm || {};

  if (!Array.isArray(entries) || entries.length === 0) {
    return { proposals: [], llm_used: false, error: "no_entries" };
  }

  const config = getLlmConfig(llmOverrides);
  const llmResult = await llmLorebookScan(entries.slice(0, 8), options, config);

  if (!llmResult.ok) {
    return {
      proposals: [],
      llm_used: false,
      error: llmResult.error || "llm_failed",
    };
  }

  const proposals = proposalsFromLlmRaw(
    llmResult.proposals,
    entries,
    defaultStage
  );

  return {
    proposals,
    llm_used: true,
    method: "sidecar_llm",
    count: proposals.length,
  };
}
