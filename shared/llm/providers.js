/** @typedef {'apiKey' | 'vertexJson' | 'none' | 'risu'} LlmAuthType */

/**
 * @typedef {object} LlmProviderDef
 * @property {string} id
 * @property {string} label
 * @property {string} defaultBaseUrl
 * @property {string} [defaultModel]
 * @property {LlmAuthType} authType
 * @property {string} [hint]
 */

export const LLM_PROVIDER_IDS = [
  "risu_main",
  "risu_aux",
  "openai",
  "anthropic",
  "vertex",
  "google_ai_studio",
  "ollama_cloud",
  "custom",
];

/** @type {Record<string, LlmProviderDef>} */
export const LLM_PROVIDERS = {
  risu_main: {
    id: "risu_main",
    label: "RisuAI 메인 모델",
    defaultBaseUrl: "",
    defaultModel: "",
    authType: "risu",
    hint: "RisuAI 앱에 설정된 메인 RP 모델을 사용합니다. API 키 입력 불필요.",
  },
  risu_aux: {
    id: "risu_aux",
    label: "RisuAI 보조 모델",
    defaultBaseUrl: "",
    defaultModel: "",
    authType: "risu",
    hint: "RisuAI 보조(Ax) 모델을 사용합니다. API 키 입력 불필요.",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    authType: "apiKey",
    hint: "OpenAI API 키 (sk-…)",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
    authType: "apiKey",
    hint: "Anthropic API 키 — OpenAI 호환 /v1/chat/completions",
  },
  vertex: {
    id: "vertex",
    label: "Vertex AI",
    defaultBaseUrl: "",
    defaultModel: "google/gemini-2.0-flash",
    authType: "vertexJson",
    hint: "서비스 계정 JSON (파일 또는 붙여넣기). OAuth 토큰으로 인증합니다.",
  },
  google_ai_studio: {
    id: "google_ai_studio",
    label: "Google AI Studio",
    defaultBaseUrl:
      "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-2.0-flash",
    authType: "apiKey",
    hint: "Google AI Studio API 키",
  },
  ollama_cloud: {
    id: "ollama_cloud",
    label: "Ollama Cloud",
    defaultBaseUrl: "https://api.ollama.com/v1",
    defaultModel: "llama3.2",
    authType: "apiKey",
    hint: "Ollama Cloud API 키 (없으면 비워 두고 로컬 Custom 사용)",
  },
  custom: {
    id: "custom",
    label: "Custom",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "",
    authType: "apiKey",
    hint: "OpenAI 호환 base URL (로컬 Ollama, 프록시 등)",
  },
};

export function getProvider(id) {
  return LLM_PROVIDERS[id] || LLM_PROVIDERS.custom;
}

export function isRisuLlmProvider(providerId) {
  return providerId === "risu_main" || providerId === "risu_aux";
}

/**
 * @param {string} projectId
 * @param {string} location
 */
export function buildVertexOpenAiBaseUrl(projectId, location = "us-central1") {
  const loc = location || "us-central1";
  const proj = projectId || "{project}";
  return `https://${loc}-aiplatform.googleapis.com/v1beta1/projects/${proj}/locations/${loc}/endpoints/openapi`;
}

/**
 * @param {object} settings
 */
export function resolveBaseUrlForSettings(settings) {
  const provider = getProvider(settings.providerId);
  if (settings.providerId === "vertex") {
    const project =
      settings.vertexProjectId ||
      parseVertexProjectId(settings.vertexJson) ||
      "{project}";
    return (
      settings.baseUrl?.trim() ||
      buildVertexOpenAiBaseUrl(project, settings.vertexLocation || "us-central1")
    );
  }
  return (settings.baseUrl || provider.defaultBaseUrl || "").trim();
}

/**
 * @param {string} raw
 */
export function parseVertexProjectId(raw) {
  if (!raw) return "";
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    return obj.project_id || obj.projectId || "";
  } catch {
    return "";
  }
}

/**
 * @param {object} settings
 */
export function settingsToLlmRaw(settings) {
  const providerId = settings.providerId || "custom";
  const provider = getProvider(providerId);
  if (isRisuLlmProvider(providerId)) {
    return {
      providerId,
      baseUrl: "risu://embedded",
      model: provider.label,
      apiKey: "",
      vertexJson: "",
      vertexLocation: settings.vertexLocation || "us-central1",
      vertexProjectId: "",
      vertexJsonImported: false,
      risuMode: providerId === "risu_main" ? "model" : "otherAx",
    };
  }
  return {
    providerId,
    baseUrl: resolveBaseUrlForSettings(settings),
    model: (settings.model || provider.defaultModel || "").trim(),
    apiKey: settings.apiKey || "",
    vertexJson: settings.vertexJson || "",
    vertexLocation: settings.vertexLocation || "us-central1",
    vertexProjectId: settings.vertexProjectId || "",
    vertexJsonImported: Boolean(settings.vertexJsonImported),
  };
}

/**
 * @param {object} raw
 * @param {import('../risu-types.js').RisuaiPluginApi | undefined} [Risuai]
 */
export function isLlmSettingsConfigured(raw, Risuai) {
  if (isRisuLlmProvider(raw?.providerId)) {
    return Boolean(Risuai?.runLLMModel);
  }
  const base = raw?.baseUrl;
  const model = raw?.model;
  if (!base || !model) return false;
  const provider = getProvider(raw.providerId);
  if (provider.authType === "vertexJson") {
    return Boolean(raw.vertexJson?.trim());
  }
  if (provider.authType === "apiKey") {
    if (raw.providerId === "custom") {
      return true;
    }
    return Boolean(raw.apiKey?.trim());
  }
  return true;
}
