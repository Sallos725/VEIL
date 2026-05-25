import { requestLorebookScan } from "../sidecar-client.js";
import { heuristicLorebookScan } from "./heuristic-scan.js";
import {
  getBrowserLlmConfig,
  isBrowserLlmConfigured,
  pluginLorebookScan,
} from "../llm/browser-client.js";
import { isRisuLlmProvider } from "../llm/providers.js";

export async function runLorebookScan({
  entries,
  options = {},
  sidecarUrl,
  llm = {},
  Risuai,
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
  const pluginLlmReady = isBrowserLlmConfigured(llmConfig, Risuai);
  const usePluginFirst =
    preferPluginLlm || isRisuLlmProvider(llmConfig.providerId);

  async function tryPluginLlm() {
    if (!pluginLlmReady) return null;
    const direct = await pluginLorebookScan(
      entries,
      payload.options,
      llmConfig,
      Risuai
    );
    if (direct.ok && direct.proposals.length) {
      return {
        proposals: direct.proposals,
        llm_used: true,
        method: direct.method || "plugin_llm",
        count: direct.proposals.length,
      };
    }
    return null;
  }

  async function trySidecar() {
    if (!sidecarUrl || isRisuLlmProvider(llmConfig.providerId)) return null;
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

  const order = usePluginFirst
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
