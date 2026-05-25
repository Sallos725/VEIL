import { requestLorebookScan } from "../sidecar-client.js";
import { heuristicLorebookScan } from "./heuristic-scan.js";
import {
  getBrowserLlmConfig,
  isBrowserLlmConfigured,
  pluginLorebookScan,
} from "../llm/browser-client.js";

export async function runLorebookScan({
  entries,
  options = {},
  sidecarUrl,
  llm = {},
  /** Lite: 플러그인에서 외부 LLM(Ollama/OpenAI 호환) 직접 호출 우선 */
  preferPluginLlm = false,
}) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      proposals: [],
      llm_used: false,
      method: "none",
      error: "no_entries",
    };
  }

  const payload = {
    entries,
    options: { default_stage: "hint", language: "ko", ...options },
    llm,
  };

  const llmConfig = getBrowserLlmConfig(llm);
  const pluginLlmReady = isBrowserLlmConfigured(llmConfig);

  async function tryPluginLlm() {
    if (!pluginLlmReady) return null;
    const direct = await pluginLorebookScan(
      entries,
      payload.options,
      llmConfig
    );
    if (direct.ok && direct.proposals.length) {
      return {
        proposals: direct.proposals,
        llm_used: true,
        method: "plugin_llm",
        count: direct.proposals.length,
      };
    }
    return null;
  }

  async function trySidecar() {
    if (!sidecarUrl) return null;
    const sidecar = await requestLorebookScan(payload, sidecarUrl);
    if (sidecar.ok && sidecar.data?.proposals?.length) {
      return {
        proposals: sidecar.data.proposals,
        llm_used: Boolean(sidecar.data.llm_used),
        method: "sidecar",
        count: sidecar.data.proposals.length,
      };
    }
    return null;
  }

  const order = preferPluginLlm
    ? [tryPluginLlm, trySidecar]
    : [trySidecar, tryPluginLlm];

  for (const attempt of order) {
    const result = await attempt();
    if (result) return result;
  }

  const heuristic = heuristicLorebookScan(entries, payload.options);
  return {
    ...heuristic,
    error: heuristic.count === 0 ? "no_proposals_heuristic" : undefined,
  };
}
