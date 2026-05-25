import { isRisuLlmProvider } from "./providers.js";

export { isRisuLlmProvider };

/** @param {import('../risu-types.js').RisuaiPluginApi | undefined} Risuai */
export function canUseRisuLlm(Risuai, providerId) {
  return Boolean(Risuai?.runLLMModel) && isRisuLlmProvider(providerId);
}

/**
 * @param {import('../risu-types.js').RisuaiPluginApi} Risuai
 * @param {string} providerId
 */
export function risuLlmModeForProvider(providerId) {
  return providerId === "risu_main" ? "model" : "otherAx";
}

/**
 * @param {unknown} res
 */
export function parseRisuLlmResponse(res) {
  if (typeof res === "string") return res;
  if (!res || typeof res !== "object") return "";
  const r = /** @type {{ type?: string; result?: string; content?: string }} */ (res);
  if (r.type === "fail") return "";
  return String(r.result ?? r.content ?? "").trim();
}

/**
 * @param {import('../risu-types.js').RisuaiPluginApi | undefined} Risuai
 * @param {Array<{ role: string; content: string }>} messages
 * @param {string} providerId
 */
export async function risuChatCompletion(Risuai, messages, providerId) {
  if (!canUseRisuLlm(Risuai, providerId)) {
    return {
      ok: false,
      error: Risuai
        ? "risu_runLLMModel_unavailable"
        : "risu_api_missing",
    };
  }

  try {
    const res = await Risuai.runLLMModel({
      mode: risuLlmModeForProvider(providerId),
      messages,
      allowPlugins: true,
    });
    const text = parseRisuLlmResponse(res);
    if (!text) {
      const failMsg =
        res && typeof res === "object" && "result" in res
          ? String(res.result || "risu_llm_failed")
          : "risu_llm_empty";
      return { ok: false, error: failMsg };
    }
    return { ok: true, content: text, via: "risu" };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "risu_llm_error",
    };
  }
}
