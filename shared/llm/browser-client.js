import {
  LOREBOOK_SCAN_SYSTEM_PROMPT,
  SEMANTIC_SYSTEM_PROMPT,
  REWRITE_SYSTEM_PROMPT,
  buildLorebookScanUserPrompt,
  buildSemanticUserPrompt,
  buildRewriteUserPrompt,
} from "./prompts.js";
import { proposalsFromLlmRaw } from "../lorebook/proposals.js";
import { getProvider, isRisuLlmProvider } from "./providers.js";
import { extractJsonObject } from "./json-utils.js";
import { risuChatCompletion, canUseRisuLlm } from "./risu-model-client.js";
import { getAccessTokenFromVertexJson } from "./google-auth.js";

const DEFAULT_BASE = "http://127.0.0.1:11434/v1";
const DEFAULT_MODEL = "llama3.2";
const LLM_TIMEOUT_MS = 120000;

let cachedVertexToken = { jsonHash: "", token: "", expiresAt: 0 };

function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

/** @param {import('../risu-types.js').RisuaiPluginApi | undefined} Risuai */
function httpFetch(Risuai) {
  if (Risuai?.nativeFetch) return (url, options) => Risuai.nativeFetch(url, options);
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }
  return null;
}

export function getBrowserLlmConfig(overrides = {}) {
  return {
    providerId: overrides.providerId || "custom",
    baseUrl: String(overrides.baseUrl || DEFAULT_BASE).replace(/\/$/, ""),
    model: overrides.model || DEFAULT_MODEL,
    apiKey: overrides.apiKey || "",
    vertexJson: overrides.vertexJson || "",
    vertexLocation: overrides.vertexLocation || "us-central1",
    vertexProjectId: overrides.vertexProjectId || "",
    risuMode: overrides.risuMode,
  };
}

/**
 * @param {ReturnType<typeof getBrowserLlmConfig>} config
 * @param {import('../risu-types.js').RisuaiPluginApi | undefined} [Risuai]
 */
export function isBrowserLlmConfigured(config, Risuai) {
  if (isRisuLlmProvider(config?.providerId)) {
    return canUseRisuLlm(Risuai, config.providerId);
  }
  const provider = getProvider(config?.providerId);
  if (!config?.baseUrl || !config?.model) return false;
  if (provider.authType === "vertexJson") {
    return Boolean(config.vertexJson?.trim());
  }
  if (provider.authType === "apiKey" && config.providerId !== "custom") {
    return Boolean(config.apiKey?.trim());
  }
  return true;
}

async function resolveAuthorization(config) {
  const provider = getProvider(config.providerId);
  if (provider.authType === "vertexJson" && config.vertexJson) {
    const hash = simpleHash(config.vertexJson);
    const now = Date.now();
    if (
      cachedVertexToken.jsonHash === hash &&
      cachedVertexToken.token &&
      cachedVertexToken.expiresAt > now + 60000
    ) {
      return cachedVertexToken.token;
    }
    const token = await getAccessTokenFromVertexJson(config.vertexJson);
    cachedVertexToken = {
      jsonHash: hash,
      token,
      expiresAt: now + 3500 * 1000,
    };
    return token;
  }
  return config.apiKey || "";
}

/**
 * @param {import('../risu-types.js').RisuaiPluginApi | undefined} Risuai
 * @param {Array<{ role: string; content: string }>} messages
 * @param {ReturnType<typeof getBrowserLlmConfig>} config
 */
export async function llmChatCompletion(Risuai, messages, config) {
  if (isRisuLlmProvider(config.providerId)) {
    return risuChatCompletion(Risuai, messages, config.providerId);
  }

  if (!isBrowserLlmConfigured(config, Risuai)) {
    return { ok: false, error: "llm_not_configured" };
  }

  const fetchImpl = httpFetch(Risuai);
  if (!fetchImpl) {
    return { ok: false, error: "fetch_unavailable" };
  }

  const headers = { "content-type": "application/json" };
  try {
    const auth = await resolveAuthorization(config);
    if (auth) headers.authorization = `Bearer ${auth}`;
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "vertex_auth_failed",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    const res = await fetchImpl(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.2,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error?.message || `llm_http_${res.status}`,
      };
    }
    return {
      ok: true,
      content: data?.choices?.[0]?.message?.content || "",
      via: "http",
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "llm_request_failed",
    };
  }
}

/** @deprecated use llmChatCompletion */
export async function browserChatCompletion(messages, config, Risuai) {
  return llmChatCompletion(Risuai, messages, config);
}

export async function pluginSemanticAssist(Risuai, draft, liteResult, llmConfig) {
  const result = await llmChatCompletion(
    Risuai,
    [
      { role: "system", content: SEMANTIC_SYSTEM_PROMPT },
      { role: "user", content: buildSemanticUserPrompt(draft, liteResult) },
    ],
    llmConfig
  );
  if (!result.ok) return { ok: false, error: result.error };

  try {
    const parsed = extractJsonObject(result.content);
    const risk = String(parsed.risk || "none").toLowerCase();
    const violations = [];
    if (risk === "high" || risk === "medium") {
      violations.push({
        secret_id: "plugin:llm",
        reason: (parsed.reasons || []).join(" ") || "LLM detected possible spoiler phrasing.",
        current_stage: "unknown",
        detected_leak: "(llm assessment)",
        suggested_rewrite:
          parsed.suggested_rewrite ||
          "Use indirect cues appropriate to the current reveal stage.",
      });
    }
    return {
      ok: true,
      data: {
        safe: violations.length === 0,
        violations,
        semantic_score: violations.length > 0 ? 0.9 : 0.05,
        llm_assisted: true,
      },
      via: result.via,
    };
  } catch {
    return { ok: false, error: "llm_invalid_json" };
  }
}

export async function pluginRewriteAssist(
  Risuai,
  draft,
  targetStage,
  liteResult,
  llmConfig
) {
  const result = await llmChatCompletion(
    Risuai,
    [
      { role: "system", content: REWRITE_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildRewriteUserPrompt(draft, targetStage, liteResult),
      },
    ],
    llmConfig
  );
  if (!result.ok) return { ok: false, error: result.error };

  try {
    const parsed = extractJsonObject(result.content);
    return {
      ok: true,
      data: {
        redacted_text: parsed.redacted_text || draft,
        explanation: parsed.explanation || "",
        remaining_risk: parsed.remaining_risk || "medium",
      },
      via: result.via,
    };
  } catch {
    return { ok: false, error: "llm_invalid_json" };
  }
}

export async function browserLorebookScan(entries, options, config, Risuai) {
  const result = await llmChatCompletion(
    Risuai,
    [
      { role: "system", content: LOREBOOK_SCAN_SYSTEM_PROMPT },
      { role: "user", content: buildLorebookScanUserPrompt(entries, options) },
    ],
    config
  );

  if (!result.ok) return { ok: false, error: result.error };

  try {
    const parsed = extractJsonObject(result.content);
    return { ok: true, proposals: parsed.proposals || [], via: result.via };
  } catch {
    return { ok: false, error: "llm_invalid_json" };
  }
}

export async function pluginLorebookScan(entries, options, llmConfig, Risuai) {
  const defaultStage = options?.default_stage || "hint";
  const llmResult = await browserLorebookScan(
    entries.slice(0, 24),
    options,
    llmConfig,
    Risuai
  );

  if (!llmResult.ok) {
    return { ok: false, error: llmResult.error };
  }

  const method =
    llmResult.via === "risu" ? "risu_llm" : "plugin_llm";

  return {
    ok: true,
    proposals: proposalsFromLlmRaw(llmResult.proposals, entries, defaultStage),
    method,
    via: llmResult.via,
  };
}
