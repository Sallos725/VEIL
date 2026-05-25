import { initVeilRuntime } from "../../shared/storage/secretStore.js";
import { BASE_TOOLS, FULL_EXTRA_TOOLS } from "../../shared/mcp/tools.js";
import {
  createFullToolHandler,
  createDefaultSidecarResolver,
} from "../../shared/mcp/handlers.js";
import { registerVeilUI } from "../../shared/ui/register.js";
import { getSidecarUrl } from "../../shared/sidecar-client.js";
import { resolvePluginOptions } from "../../shared/plugin-options.js";
import { createLlmSettingsStore } from "../../shared/storage/llmSettingsStore.js";

const DEFAULT_SIDECAR_URL = "http://127.0.0.1:6010";

async function registerVeilFull(Risuai, secrets, store, resolveSidecarUrl) {
  if (!Risuai || !Risuai.registerMCP) {
    console.log("[VEIL Full] Risuai.registerMCP is not available.");
    return;
  }

  await Risuai.registerMCP(
    {
      identifier: "plugin:veil_full",
      name: "VEIL Full",
      version: "0.0.1",
      description:
        "Visibility Enforcement & Integrity Layer with optional sidecar assistance.",
    },
    async () => [...BASE_TOOLS, ...FULL_EXTRA_TOOLS],
    createFullToolHandler(secrets, store, resolveSidecarUrl, Risuai)
  );

  console.log("[VEIL Full] MCP module registered.");
}

(async () => {
  try {
    const Risuai = typeof globalThis.Risuai !== "undefined" ? globalThis.Risuai : undefined;
    const resolveSidecarUrl = Risuai
      ? await createDefaultSidecarResolver(Risuai, DEFAULT_SIDECAR_URL)
      : async () => getSidecarUrl(DEFAULT_SIDECAR_URL);

    const { store, secrets } = await initVeilRuntime({
      edition: "full",
      Risuai,
      sidecarUrl: DEFAULT_SIDECAR_URL,
      getSidecarUrl: resolveSidecarUrl,
    });

    const llmStore = Risuai ? createLlmSettingsStore(Risuai) : null;
    const pluginOptions = Risuai
      ? await resolvePluginOptions(
          Risuai,
          { sidecarUrl: DEFAULT_SIDECAR_URL },
          llmStore
        )
      : { sidecarUrl: DEFAULT_SIDECAR_URL, llm: {}, llmRaw: {}, llmConfigured: false };
    const refreshOptions = Risuai
      ? () =>
          resolvePluginOptions(
            Risuai,
            { sidecarUrl: DEFAULT_SIDECAR_URL },
            llmStore
          )
      : null;

    if (Risuai) {
      await registerVeilFull(Risuai, secrets, store, resolveSidecarUrl);
      await registerVeilUI(Risuai, {
        secrets,
        store,
        edition: "full",
        resolveSidecarUrl,
        pluginOptions,
        llmStore,
        refreshOptions,
      });
    } else {
      console.log("[VEIL Full] Risuai is not available (dev/bundle context).");
    }
  } catch (error) {
    console.log(
      `[VEIL Full] Error: ${error && error.message ? error.message : error}`
    );
  }
})();
