export const RP_SETTINGS_KEY = "veil_rp_settings";

export const DEFAULT_RP_SETTINGS = {
  enabled: true,
  injectGuidance: true,
  enforceRedact: true,
  showVeilNote: false,
};

export function normalizeRpSettings(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_RP_SETTINGS };
  }
  return {
    enabled: raw.enabled !== false,
    injectGuidance: raw.injectGuidance !== false,
    enforceRedact: raw.enforceRedact !== false,
    showVeilNote: Boolean(raw.showVeilNote),
  };
}

/**
 * @param {import('../risu-types.js').RisuaiPluginApi} Risuai
 */
export function createRpSettingsStore(Risuai) {
  let memory = { ...DEFAULT_RP_SETTINGS };
  let storageReady = null;

  async function getStorage() {
    if (!Risuai?.getLocalPluginStorage) return null;
    if (!storageReady) storageReady = Risuai.getLocalPluginStorage();
    return storageReady;
  }

  return {
    async load() {
      const storage = await getStorage();
      if (storage) {
        const saved = await storage.getItem(RP_SETTINGS_KEY);
        if (saved && typeof saved === "object") {
          memory = normalizeRpSettings(saved);
          return memory;
        }
      }
      memory = normalizeRpSettings(memory);
      return memory;
    },
    async save(settings) {
      memory = normalizeRpSettings(settings);
      const storage = await getStorage();
      if (storage) {
        await storage.setItem(
          RP_SETTINGS_KEY,
          JSON.parse(JSON.stringify(memory))
        );
      }
      return memory;
    },
    get() {
      return normalizeRpSettings(memory);
    },
  };
}
