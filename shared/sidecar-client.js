const DEFAULT_SIDECAR_URL = "http://127.0.0.1:8787";
const SIDECAR_TIMEOUT_MS = 2000;

export function getSidecarUrl(configUrl) {
  return configUrl || DEFAULT_SIDECAR_URL;
}

export async function fetchSidecar(path, options = {}) {
  const baseUrl = getSidecarUrl(options.baseUrl);
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SIDECAR_TIMEOUT_MS);

  try {
    if (typeof fetch === "undefined") {
      return { ok: false, error: "fetch is not available in this environment" };
    }

    const response = await fetch(url, {
      method: options.method || "GET",
      headers: {
        "content-type": "application/json",
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : "sidecar unreachable",
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
