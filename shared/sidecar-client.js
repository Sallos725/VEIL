const DEFAULT_SIDECAR_URL = "http://127.0.0.1:6010";
const SIDECAR_TIMEOUT_MS = 2000;

/** @type {typeof fetch | null} */
let sidecarHttpFetch =
  typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null;

/**
 * Override HTTP client (e.g. Risuai.nativeFetch) for sandboxed plugins.
 * @param {typeof fetch} impl
 */
export function setSidecarHttpFetch(impl) {
  sidecarHttpFetch = impl;
}

export function getSidecarUrl(configUrl) {
  return configUrl || DEFAULT_SIDECAR_URL;
}

function cspHintFromError(error) {
  const msg = String(error?.message || error || "");
  if (
    msg.includes("Content Security Policy") ||
    msg.includes("connect-src") ||
    msg.includes("Refused to connect")
  ) {
    return " RisuAI 플러그인 샌드박스 CSP — VEIL 최신 빌드(nativeFetch) 필요.";
  }
  return "";
}

export async function fetchSidecar(path, options = {}) {
  const baseUrl = getSidecarUrl(options.baseUrl);
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || SIDECAR_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (!sidecarHttpFetch) {
      return { ok: false, error: "fetch is not available in this environment" };
    }

    const method = options.method || "GET";
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers["content-type"] && !headers["Content-Type"]) {
      headers["content-type"] = "application/json";
    }

    const response = await sidecarHttpFetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    const base =
      error && error.message ? error.message : "sidecar unreachable";
    return {
      ok: false,
      error: base + cspHintFromError(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkSidecarHealth(baseUrl) {
  const result = await fetchSidecar("/health", { baseUrl });
  if (!result.ok) {
    return {
      enabled: true,
      reachable: false,
      features: [],
      error: result.error || "health check failed",
    };
  }

  return {
    enabled: true,
    reachable: true,
    version: result.data && result.data.version,
    features: (result.data && result.data.features) || [],
  };
}

export async function requestSemanticCheck(payload, baseUrl) {
  return fetchSidecar("/semantic-check", {
    method: "POST",
    baseUrl,
    body: payload,
  });
}

export async function requestRewrite(payload, baseUrl) {
  return fetchSidecar("/rewrite", {
    method: "POST",
    baseUrl,
    body: payload,
  });
}

export async function requestLlmStatus(baseUrl) {
  return fetchSidecar("/llm/status", { baseUrl });
}

export async function requestLorebookScan(payload, baseUrl) {
  return fetchSidecar("/lorebook/scan", {
    method: "POST",
    baseUrl,
    body: payload,
    timeoutMs: 120000,
  });
}
