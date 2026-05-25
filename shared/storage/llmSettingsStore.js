import {
  getProvider,
  settingsToLlmRaw,
  parseVertexProjectId,
} from "../llm/providers.js";

export const LLM_SETTINGS_KEY = "veil_llm_settings";

const DEFAULT_SETTINGS = {
  providerId: "ollama_cloud",
  baseUrl: "",
  model: "",
  apiKey: "",
  vertexJson: "",
  vertexLocation: "us-central1",
  vertexProjectId: "",
  vertexJsonImported: false,
  sidecarUrl: "",
};

export function normalizeLlmSettings(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_SETTINGS };
  }
  const providerId = LLM_PROVIDERS_SAFE(raw.providerId);
  const provider = getProvider(providerId);
  let vertexJson = String(raw.vertexJson || "");
  let vertexProjectId = String(raw.vertexProjectId || "");
  if (vertexJson && !vertexProjectId) {
    vertexProjectId = parseVertexProjectId(vertexJson);
  }
  return {
    providerId,
    baseUrl: String(raw.baseUrl ?? provider.defaultBaseUrl ?? ""),
    model: String(raw.model ?? provider.defaultModel ?? ""),
    apiKey: String(raw.apiKey || ""),
    vertexJson,
    vertexLocation: String(raw.vertexLocation || "us-central1"),
    vertexProjectId,
    vertexJsonImported: Boolean(raw.vertexJsonImported),
    sidecarUrl: String(raw.sidecarUrl || ""),
  };
}

function LLM_PROVIDERS_SAFE(id) {
  const ids = [
    "openai",
    "anthropic",
    "vertex",
    "google_ai_studio",
    "ollama_cloud",
    "custom",
  ];
  return ids.includes(id) ? id : "custom";
}

export function createLlmSettingsStore(Risuai) {
  let memory = { ...DEFAULT_SETTINGS };
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
        const saved = await storage.getItem(LLM_SETTINGS_KEY);
        if (saved && typeof saved === "object") {
          memory = normalizeLlmSettings(saved);
          return memory;
        }
      }
      memory = normalizeLlmSettings(memory);
      return memory;
    },
    async save(settings) {
      memory = normalizeLlmSettings(settings);
      const storage = await getStorage();
      if (storage) {
        await storage.setItem(LLM_SETTINGS_KEY, JSON.parse(JSON.stringify(memory)));
      }
      return memory;
    },
    get() {
      return normalizeLlmSettings(memory);
    },
    toLlmRaw() {
      return settingsToLlmRaw(memory);
    },
  };
}
