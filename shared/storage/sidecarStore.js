import { fetchSidecar, getSidecarUrl, checkSidecarHealth } from "../sidecar-client.js";
import { validateSecrets } from "./pluginStore.js";

const CACHE_KEY = "veil_secrets_cache";

const SIDECAR_REQUIRED_MSG =
  "VEIL Full은 sidecar가 필요합니다. Docker로 sidecar를 실행한 뒤 다시 여세요.";

export function createSidecarStore(ctx) {
  const { Risuai, getSidecarUrl: resolveUrl } = ctx;
  let memory = [];
  let lastSource = "unavailable";
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

  function unavailablePayload(cached) {
    return {
      secrets: cached ? JSON.parse(JSON.stringify(cached)) : [],
      source: cached ? "cache" : "unavailable",
      sidecarOnline: false,
      sidecarRequired: true,
      readOnly: true,
      error: SIDECAR_REQUIRED_MSG,
    };
  }

  return {
    edition: "full",
    sidecarRequired: true,
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
          return {
            secrets: memory,
            source: lastSource,
            sidecarOnline: true,
            sidecarRequired: true,
            readOnly: false,
          };
        }
      }

      const cached = await loadCache();
      memory = cached ? JSON.parse(JSON.stringify(cached)) : [];
      lastSource = cached ? "cache" : "unavailable";
      return unavailablePayload(cached);
    },
    async save(secrets) {
      const url = await baseUrl();
      const health = await checkSidecarHealth(url);
      sidecarOnline = health.reachable;

      if (!sidecarOnline) {
        return {
          ok: false,
          error: SIDECAR_REQUIRED_MSG,
          source: lastSource,
          sidecarSynced: false,
        };
      }

      memory = secrets;
      await saveCache(secrets);

      const result = await fetchSidecar("/secrets", {
        method: "PUT",
        baseUrl: url,
        body: { secrets },
      });

      sidecarOnline = result.ok;
      lastSource = result.ok ? "sidecar" : "cache";

      if (!result.ok) {
        return {
          ok: false,
          error: result.error || "Sidecar 저장 실패",
          source: lastSource,
          sidecarSynced: false,
        };
      }

      return {
        ok: true,
        source: lastSource,
        sidecarSynced: true,
      };
    },
    getStatus() {
      return {
        source: lastSource,
        sidecarOnline,
        sidecarRequired: true,
        readOnly: !sidecarOnline,
      };
    },
    async importSecrets(secrets) {
      if (!validateSecrets(secrets)) {
        return { ok: false, error: "유효하지 않은 시크릿 JSON입니다." };
      }
      const url = await baseUrl();
      const health = await checkSidecarHealth(url);
      if (!health.reachable) {
        return { ok: false, error: SIDECAR_REQUIRED_MSG };
      }

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
      return {
        ok: false,
        error: result.error || "Sidecar import 실패",
      };
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
      return { ...health, sidecarRequired: true };
    },
  };
}
