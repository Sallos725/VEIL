import { createPluginStore } from "./pluginStore.js";
import { createSidecarStore } from "./sidecarStore.js";
import { cloneSampleSecrets } from "../sample-secrets.js";

export { validateSecrets, STORAGE_KEY } from "./pluginStore.js";

export function createSecretStore(ctx) {
  if (ctx.edition === "full") {
    return createSidecarStore(ctx);
  }
  return createPluginStore(ctx);
}

export async function initVeilRuntime(ctx) {
  const store = createSecretStore(ctx);
  const loaded = await store.load();
  return {
    store,
    secrets: loaded.secrets,
    meta: {
      source: loaded.source,
      sidecarOnline: loaded.sidecarOnline,
    },
  };
}

export function resetSecretsToSample(secrets) {
  const sample = cloneSampleSecrets();
  secrets.length = 0;
  secrets.push(...sample);
}
