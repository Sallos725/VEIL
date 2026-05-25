import { cloneSampleSecrets } from "../sample-secrets.js";

export const STORAGE_KEY = "veil_secrets";

export function validateSecrets(secrets) {
  if (!Array.isArray(secrets)) return false;
  return secrets.every(
    (s) => s && typeof s.id === "string" && typeof s.revealStage === "string"
  );
}

export function createPluginStore(ctx) {
  const { Risuai } = ctx;
  let memory = null;
  let storageReady = null;

  async function getStorage() {
    if (!Risuai || !Risuai.getLocalPluginStorage) return null;
    if (!storageReady) {
      storageReady = Risuai.getLocalPluginStorage();
    }
    return storageReady;
  }

  return {
    edition: "lite",
    async load() {
      const storage = await getStorage();
      if (storage) {
        const saved = await storage.getItem(STORAGE_KEY);
        if (validateSecrets(saved)) {
          memory = JSON.parse(JSON.stringify(saved));
          return {
            secrets: memory,
            source: "pluginStorage",
            sidecarOnline: false,
          };
        }
      }
      memory = cloneSampleSecrets();
      return {
        secrets: memory,
        source: "sample",
        sidecarOnline: false,
      };
    },
    async save(secrets) {
      memory = secrets;
      const storage = await getStorage();
      if (storage) {
        await storage.setItem(STORAGE_KEY, JSON.parse(JSON.stringify(secrets)));
      }
      return { ok: true, source: "pluginStorage" };
    },
    getStatus() {
      return { source: "pluginStorage", sidecarOnline: false };
    },
    async importSecrets(secrets) {
      if (!validateSecrets(secrets)) {
        return { ok: false, error: "유효하지 않은 시크릿 JSON입니다." };
      }
      await this.save(JSON.parse(JSON.stringify(secrets)));
      return { ok: true };
    },
    async exportSecrets() {
      return JSON.parse(JSON.stringify(memory || []));
    },
  };
}
