import {
  SEMANTIC_SYSTEM_PROMPT,
  LOREBOOK_SCAN_SYSTEM_PROMPT,
  buildSemanticUserPrompt,
  buildLorebookScanUserPrompt,
} from "../../../shared/llm/prompts.js";

const DEFAULT_BASE = "http://127.0.0.1:11434/v1";
const DEFAULT_MODEL = "llama3.2";
const LLM_TIMEOUT_MS = Number(process.env.VEIL_LLM_TIMEOUT_MS || 120000);

export function getLlmConfig(overrides = {}) {
  return {
    baseUrl: (overrides.baseUrl || process.env.VEIL_LLM_BASE_URL || DEFAULT_BASE).replace(
      /\/$/,
      ""
    ),
    model: overrides.model || process.env.VEIL_LLM_MODEL || DEFAULT_MODEL,
    apiKey: overrides.apiKey || process.env.VEIL_LLM_API_KEY || "",
  };
}

export function isLlmConfigured(config = getLlmConfig()) {
  return Boolean(config.baseUrl && config.model);
}

export async function getLlmStatus(config = getLlmConfig()) {
  if (!isLlmConfigured(config)) {
    return {
      configured: false,
      reachable: false,
      model: null,
      provider: "none",
    };
  }

  try {
    const headers = { "content-type": "application/json" };
    if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;

    const res = await fetch(`${config.baseUrl}/models`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    return {
      configured: true,
      reachable: res.ok,
      model: config.model,
      provider: config.baseUrl.includes("11434") ? "ollama" : "openai_compatible",
      baseUrl: config.baseUrl,
    };
  } catch {
    return {
      configured: true,
      reachable: false,
      model: config.model,
      provider: "openai_compatible",
      baseUrl: config.baseUrl,
    };
  }
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

export async function chatCompletion(messages, config = getLlmConfig()) {
  if (!isLlmConfigured(config)) {
    return { ok: false, error: "llm_not_configured" };
  }

  const headers = { "content-type": "application/json" };
  if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.2,
        stream: false,
      }),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error?.message || `llm_http_${res.status}`,
      };
    }

    const content = data?.choices?.[0]?.message?.content || "";
    return { ok: true, content };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : "llm_request_failed",
    };
  }
}

export async function llmSemanticAssist(draft, liteResult, config) {
  const result = await chatCompletion(
    [
      { role: "system", content: SEMANTIC_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildSemanticUserPrompt(draft, liteResult),
      },
    ],
    config
  );

  if (!result.ok) return { ok: false, error: result.error };

  try {
    const parsed = extractJsonObject(result.content);
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: "llm_invalid_json" };
  }
}

export async function llmLorebookScan(entries, options, config) {
  const result = await chatCompletion(
    [
      { role: "system", content: LOREBOOK_SCAN_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildLorebookScanUserPrompt(entries, options),
      },
    ],
    config
  );

  if (!result.ok) return { ok: false, error: result.error };

  try {
    const parsed = extractJsonObject(result.content);
    const proposals = Array.isArray(parsed.proposals) ? parsed.proposals : [];
    return { ok: true, proposals };
  } catch {
    return { ok: false, error: "llm_invalid_json" };
  }
}
