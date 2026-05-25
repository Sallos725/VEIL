import { initVeilRuntime } from "../../shared/storage/secretStore.js";
import { configureVeilHttpForRisu } from "../../shared/configure-risu-fetch.js";
import { registerVeilUI } from "../../shared/ui/register.js";
import { getSidecarUrl } from "../../shared/sidecar-client.js";
import { resolvePluginOptions } from "../../shared/plugin-options.js";
import { createLlmSettingsStore } from "../../shared/storage/llmSettingsStore.js";
import { createRpSettingsStore } from "../../shared/storage/rp-settings-store.js";
import { registerVeilReplacers } from "../../shared/risu-replacers.js";
import { createDefaultSidecarResolver } from "../../shared/veil-service.js";
import { VEIL_VERSION } from "../../shared/plugin-meta.js";

const DEFAULT_SIDECAR_URL = "http://127.0.0.1:6010";

(async () => {
  try {
    const Risuai = typeof globalThis.Risuai !== "undefined" ? globalThis.Risuai : undefined;
    configureVeilHttpForRisu(Risuai);
    const llmStore = Risuai ? createLlmSettingsStore(Risuai) : null;
    const rpSettingsStore = Risuai ? createRpSettingsStore(Risuai) : null;
    if (rpSettingsStore) await rpSettingsStore.load();

    let replacerStatus = { ok: false, reason: "not_registered" };
    const resolveSidecarUrl = Risuai
      ? await createDefaultSidecarResolver(
          Risuai,
          DEFAULT_SIDECAR_URL,
          llmStore
        )
      : async () => getSidecarUrl(DEFAULT_SIDECAR_URL);

    const { store, secrets } = await initVeilRuntime({
      edition: "full",
      Risuai,
      sidecarUrl: DEFAULT_SIDECAR_URL,
      getSidecarUrl: resolveSidecarUrl,
    });

    if (Risuai) {
      replacerStatus = await registerVeilReplacers(Risuai, {
        secrets,
        store,
        rpSettingsStore,
      });
    }

    const pluginOptions = Risuai
      ? await resolvePluginOptions(
          Risuai,
          { sidecarUrl: DEFAULT_SIDECAR_URL },
          llmStore
        )
      : {
          sidecarUrl: DEFAULT_SIDECAR_URL,
          llm: {},
          llmRaw: {},
          llmConfigured: false,
        };
    const refreshOptions = Risuai
      ? () =>
          resolvePluginOptions(
            Risuai,
            { sidecarUrl: DEFAULT_SIDECAR_URL },
            llmStore
          )
      : null;

    if (Risuai) {
      await registerVeilUI(Risuai, {
        secrets,
        store,
        edition: "full",
        resolveSidecarUrl,
        pluginOptions,
        llmStore,
        rpSettingsStore,
        replacerStatus,
        refreshOptions,
      });
      console.log(`[VEIL Full ${VEIL_VERSION}] GUI registered (sidecar required, no MCP).`);
    } else {
      console.log("[VEIL Full] Risuai is not available (dev/bundle context).");
    }
  } catch (error) {
    console.log(
      `[VEIL Full] Error: ${error && error.message ? error.message : error}`
    );
  }
})();
