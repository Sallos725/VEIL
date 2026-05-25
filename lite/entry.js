import { initVeilRuntime } from "../shared/storage/secretStore.js";
import { configureVeilHttpForRisu } from "../shared/configure-risu-fetch.js";
import { registerVeilUI } from "../shared/ui/register.js";
import {
  resolvePluginOptions,
  createSidecarResolver,
} from "../shared/plugin-options.js";
import { createLlmSettingsStore } from "../shared/storage/llmSettingsStore.js";
import { createRpSettingsStore } from "../shared/storage/rp-settings-store.js";
import { registerVeilReplacers } from "../shared/risu-replacers.js";
import { VEIL_VERSION } from "../shared/plugin-meta.js";

(async () => {
  try {
    const Risuai = typeof globalThis.Risuai !== "undefined" ? globalThis.Risuai : undefined;
    configureVeilHttpForRisu(Risuai);
    const { store, secrets } = await initVeilRuntime({
      edition: "lite",
      Risuai,
    });

    const llmStore = Risuai ? createLlmSettingsStore(Risuai) : null;
    const rpSettingsStore = Risuai ? createRpSettingsStore(Risuai) : null;
    if (rpSettingsStore) await rpSettingsStore.load();

    let replacerStatus = { ok: false, reason: "not_registered" };
    if (Risuai) {
      replacerStatus = await registerVeilReplacers(Risuai, {
        secrets,
        store,
        rpSettingsStore,
      });
    }
    const pluginOptions = Risuai
      ? await resolvePluginOptions(Risuai, {}, llmStore)
      : { sidecarUrl: "", llm: {}, llmRaw: {}, llmConfigured: false };
    const resolveSidecarUrl = Risuai
      ? await createSidecarResolver(Risuai, "")
      : null;
    const refreshOptions = Risuai
      ? () => resolvePluginOptions(Risuai, {}, llmStore)
      : null;

    if (Risuai) {
      await registerVeilUI(Risuai, {
        secrets,
        store,
        edition: "lite",
        pluginOptions,
        llmStore,
        rpSettingsStore,
        replacerStatus,
        refreshOptions,
        resolveSidecarUrl,
      });
      console.log(`[VEIL Lite ${VEIL_VERSION}] GUI registered (no MCP).`);
    } else {
      console.log("[VEIL Lite] Risuai is not available (dev/bundle context).");
    }
  } catch (error) {
    console.log(
      `[VEIL Lite] Error: ${error && error.message ? error.message : error}`
    );
  }
})();
