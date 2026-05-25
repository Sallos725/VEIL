import {
  LOREBOOK_SCAN_SYSTEM_PROMPT,
  buildLorebookScanUserPrompt,
} from "./prompts.js";
import { proposalsFromLlmRaw } from "../lorebook/proposals.js";
import { getAccessTokenFromVertexJson } from "./google-auth.js";
import { getProvider } from "./providers.js";

const DEFAULT_BASE = "http://127.0.0.1:11434/v1";
const DEFAULT_MODEL = "llama3.2";
const LLM_TIMEOUT_MS = 120000;

let cachedVertexToken = { jsonHash: "", token: "", expiresAt: 0 };

function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
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
  };
}

export function isBrowserLlmConfigured(config) {
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

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(candidate.slice(start, end + 1));
  }
  return JSON.parse(candidate);
}

export async function browserChatCompletion(messages, config) {
  if (!isBrowserLlmConfigured(config)) {
    return { ok: false, error: "llm_not_configured" };
  }
  if (typeof fetch === "undefined") {
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
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
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
    return { ok: true, content: data?.choices?.[0]?.message?.content || "" };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "llm_request_failed",
    };
  }
}

export async function browserLorebookScan(entries, options, config) {
  const result = await browserChatCompletion(
    [
      { role: "system", content: LOREBOOK_SCAN_SYSTEM_PROMPT },
      { role: "user", content: buildLorebookScanUserPrompt(entries, options) },
    ],
    config
  );

  if (!result.ok) return { ok: false, error: result.error };

  try {
    const parsed = extractJsonObject(result.content);
    return { ok: true, proposals: parsed.proposals || [] };
  } catch {
    return { ok: false, error: "llm_invalid_json" };
  }
}

export async function pluginLorebookScan(entries, options, llmConfig) {
  const defaultStage = options?.default_stage || "hint";
  const llmResult = await browserLorebookScan(
    entries.slice(0, 24),
    options,
    llmConfig
  );

  if (!llmResult.ok) {
    return { ok: false, error: llmResult.error };
  }

  return {
    ok: true,
    proposals: proposalsFromLlmRaw(llmResult.proposals, entries, defaultStage),
    method: "plugin_llm",
  };
}
