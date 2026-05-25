import { cloneSampleSecrets } from "../sample-secrets.js";
import { fetchSidecar, getSidecarUrl, checkSidecarHealth } from "../sidecar-client.js";
import { validateSecrets, STORAGE_KEY } from "./pluginStore.js";

const CACHE_KEY = "veil_secrets_cache";

export function createSidecarStore(ctx) {
  const { Risuai, getSidecarUrl: resolveUrl } = ctx;
  let memory = null;
  let lastSource = "sample";
  let sidecarOnline = false;

  async function getStorage() {
    if (!Risuai || !Risuai.getLocalPluginStorage) return null;
    return Risuai.getLocalPluginStorage();
  }

  async function saveCache(secrets) {
    const storage = await getStorage();
    if (storage) {
      await storage.setItem(CACHE_KEY, JSON.parse(JSON.stringify(secrets)));
    }
  }

  async function loadCache() {
    const storage = await getStorage();
    if (!storage) return null;
    const cached = await storage.getItem(CACHE_KEY);
    return validateSecrets(cached) ? cached : null;
  }

  async function baseUrl() {
    if (resolveUrl) return resolveUrl();
    return getSidecarUrl(ctx.sidecarUrl);
  }

  return {
    edition: "full",
    async load() {
      const url = await baseUrl();
      const health = await checkSidecarHealth(url);
      sidecarOnline = health.reachable;

      if (sidecarOnline) {
        const result = await fetchSidecar("/secrets", { baseUrl: url });
        if (result.ok && validateSecrets(result.data?.secrets)) {
          memory = JSON.parse(JSON.stringify(result.data.secrets));
          lastSource = "sidecar";
          await saveCache(memory);
          return { secrets: memory, source: lastSource, sidecarOnline: true };
        }
      }

      const cached = await loadCache();
      if (cached) {
        memory = JSON.parse(JSON.stringify(cached));
        lastSource = "cache";
        return { secrets: memory, source: lastSource, sidecarOnline };
      }

      memory = cloneSampleSecrets();
      lastSource = "sample";
      return { secrets: memory, source: lastSource, sidecarOnline };
    },
    async save(secrets) {
      memory = secrets;
      await saveCache(secrets);

      const url = await baseUrl();
      const result = await fetchSidecar("/secrets", {
        method: "PUT",
        baseUrl: url,
        body: { secrets },
      });

      sidecarOnline = result.ok;
      lastSource = result.ok ? "sidecar" : "cache";

      return {
        ok: true,
        source: lastSource,
        sidecarSynced: result.ok,
        error: result.ok ? undefined : result.error,
      };
    },
    getStatus() {
      return { source: lastSource, sidecarOnline };
    },
    async importSecrets(secrets) {
      if (!validateSecrets(secrets)) {
        return { ok: false, error: "유효하지 않은 시크릿 JSON입니다." };
      }
      const url = await baseUrl();
      const result = await fetchSidecar("/secrets/import", {
        method: "POST",
        baseUrl: url,
        body: { secrets },
      });
      if (result.ok && validateSecrets(result.data?.secrets)) {
        memory = JSON.parse(JSON.stringify(result.data.secrets));
        await saveCache(memory);
        lastSource = "sidecar";
        sidecarOnline = true;
        return { ok: true };
      }
      await this.save(JSON.parse(JSON.stringify(secrets)));
      return { ok: true, fallback: true };
    },
    async exportSecrets() {
      const url = await baseUrl();
      const result = await fetchSidecar("/secrets/export", { baseUrl: url });
      if (result.ok && validateSecrets(result.data?.secrets)) {
        return result.data.secrets;
      }
      return JSON.parse(JSON.stringify(memory || []));
    },
    async refreshHealth() {
      const url = await baseUrl();
      const health = await checkSidecarHealth(url);
      sidecarOnline = health.reachable;
      return health;
    },
  };
}
