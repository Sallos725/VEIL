import { getSidecarUrl } from "./sidecar-client.js";
import { getBrowserLlmConfig } from "./llm/browser-client.js";
import {
  settingsToLlmRaw,
  isLlmSettingsConfigured,
} from "./llm/providers.js";
import { createLlmSettingsStore, normalizeLlmSettings } from "./storage/llmSettingsStore.js";

const DEFAULT_SIDECAR = "http://127.0.0.1:6010";

/**
 * @param {import('./storage/llmSettingsStore.js').ReturnType<createLlmSettingsStore>} llmStore
 * @param {object} defaults
 */
export async function resolvePluginOptions(Risuai, defaults = {}, llmStore = null) {
  let sidecarUrl = defaults.sidecarUrl || "";

  const store = llmStore || (Risuai ? createLlmSettingsStore(Risuai) : null);
  let settings = normalizeLlmSettings({});
  if (store) {
    settings = await store.load();
  }

  if (settings.sidecarUrl) {
    sidecarUrl = settings.sidecarUrl;
  } else if (Risuai?.getArgument) {
    const argSidecar = await Risuai.getArgument("sidecar_url");
    if (argSidecar) sidecarUrl = String(argSidecar);
  }

  const llmRaw = settingsToLlmRaw(settings);
  const llm = getBrowserLlmConfig(llmRaw);

  return {
    sidecarUrl: sidecarUrl ? getSidecarUrl(sidecarUrl) : "",
    llm,
    llmRaw,
    llmSettings: settings,
    llmConfigured: isLlmSettingsConfigured(llmRaw, Risuai),
    risuLlmAvailable: Boolean(Risuai?.runLLMModel),
    llmStore: store,
  };
}

export async function createSidecarResolver(
  Risuai,
  defaultUrl = "",
  llmStore = null
) {
  return async function resolveSidecarUrl(ctx) {
    const fromCtx = ctx && ctx.sidecar_url;
    if (fromCtx) return getSidecarUrl(fromCtx);
    const opts = await resolvePluginOptions(
      Risuai,
      { sidecarUrl: defaultUrl || "" },
      llmStore
    );
    if (opts.sidecarUrl) return opts.sidecarUrl;
    if (defaultUrl) return getSidecarUrl(defaultUrl);
    return "";
  };
}
