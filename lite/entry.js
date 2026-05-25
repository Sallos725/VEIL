import { initVeilRuntime } from "../shared/storage/secretStore.js";
import { BASE_TOOLS, LITE_EXTRA_TOOLS } from "../shared/mcp/tools.js";
import { createLiteToolHandler } from "../shared/mcp/handlers.js";
import { registerVeilUI } from "../shared/ui/register.js";
import {
  resolvePluginOptions,
  createSidecarResolver,
} from "../shared/plugin-options.js";
import { createLlmSettingsStore } from "../shared/storage/llmSettingsStore.js";

async function registerVeilLite(Risuai, secrets, store, resolveSidecarUrl) {
  if (!Risuai || !Risuai.registerMCP) {
    console.log("[VEIL Lite] Risuai.registerMCP is not available.");
    return;
  }

  await Risuai.registerMCP(
    {
      identifier: "plugin:veil_lite",
      name: "VEIL Lite",
      version: "0.0.1",
      description:
        "Visibility Enforcement & Integrity Layer for staged secret disclosure.",
    },
    async () => [...BASE_TOOLS, ...LITE_EXTRA_TOOLS],
    createLiteToolHandler(secrets, store, resolveSidecarUrl, Risuai)
  );

  console.log("[VEIL Lite] MCP module registered.");
}

(async () => {
  try {
    const Risuai = typeof globalThis.Risuai !== "undefined" ? globalThis.Risuai : undefined;
    const { store, secrets } = await initVeilRuntime({
      edition: "lite",
      Risuai,
    });

    const llmStore = Risuai ? createLlmSettingsStore(Risuai) : null;
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
      await registerVeilLite(Risuai, secrets, store, resolveSidecarUrl);
      await registerVeilUI(Risuai, {
        secrets,
        store,
        edition: "lite",
        pluginOptions,
        llmStore,
        refreshOptions,
        resolveSidecarUrl,
      });
    } else {
      console.log("[VEIL Lite] Risuai is not available (dev/bundle context).");
    }
  } catch (error) {
    console.log(
      `[VEIL Lite] Error: ${error && error.message ? error.message : error}`
    );
  }
})();
