import http from "node:http";
import { pathToFileURL } from "node:url";
import { normalizeText } from "../../../shared/text.js";
import { cloneSampleSecrets } from "../../../shared/sample-secrets.js";
import {
  loadSecrets,
  replaceSecrets,
  patchSecretStage,
  maskSecretsForResponse,
  maskSecretForResponse,
  validateSecretsArray,
  setDefaultSecretsLoader,
} from "./secrets-persist.js";
import { getLlmStatus, llmSemanticAssist, getLlmConfig } from "./llm-client.js";
import { scanLorebookEntries } from "./lorebook-scan.js";

const PORT = Number(process.env.VEIL_PORT || 6010);
const HOST = process.env.VEIL_HOST || "127.0.0.1";

setDefaultSecretsLoader(() => cloneSampleSecrets());

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function parsePath(url) {
  const [pathname] = url.split("?");
  return pathname;
}

function tokenize(text) {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function overlapScore(a, b) {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap += 1;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

function keywordSemanticCheck(payload) {
  const draft = payload.draft_text || "";
  const lite = payload.lite_result || { violations: [] };
  const violations = [...(lite.violations || [])];
  const draftNorm = normalizeText(draft);
  const suspiciousPhrases = [
    "already knew",
    "hiding it",
    "full truth",
    "secretly suspects",
  ];

  for (const phrase of suspiciousPhrases) {
    if (
      draftNorm.includes(normalizeText(phrase)) &&
      overlapScore(draft, phrase) > 0.4
    ) {
      violations.push({
        secret_id: "sidecar:semantic",
        reason: "Sidecar detected suspicious spoiler-like phrasing.",
        current_stage: "unknown",
        detected_leak: phrase,
        suggested_rewrite:
          "Soften the statement or replace with indirect emotional cues.",
      });
    }
  }

  return {
    safe: violations.length === 0,
    violations,
    semantic_score: violations.length > 0 ? 0.85 : 0.1,
    llm_assisted: false,
  };
}

async function semanticCheck(payload) {
  const base = keywordSemanticCheck(payload);
  const config = getLlmConfig(payload.llm || {});
  const llm = await llmSemanticAssist(
    payload.draft_text || "",
    payload.lite_result,
    config
  );

  if (!llm.ok || !llm.data) return base;

  const violations = [...base.violations];
  const risk = String(llm.data.risk || "none").toLowerCase();

  if (risk === "high" || risk === "medium") {
    violations.push({
      secret_id: "sidecar:llm",
      reason: llm.data.reasons?.join(" ") || "LLM detected possible spoiler phrasing.",
      current_stage: "unknown",
      detected_leak: "(llm assessment)",
      suggested_rewrite:
        llm.data.suggested_rewrite ||
        "Use indirect cues appropriate to the current reveal stage.",
    });
  }

  return {
    safe: violations.length === 0,
    violations,
    semantic_score: violations.length > 0 ? 0.9 : 0.05,
    llm_assisted: true,
  };
}

function rewriteDraft(payload) {
  const lite = payload.lite_result || {};
  const draft = String(payload.draft_text || "");
  const targetStage = payload.target_stage || "hint";
  return {
    redacted_text: lite.redacted_text || draft,
    explanation:
      (lite.explanation || "") +
      ` Sidecar rewrite hint: keep output at or below ${targetStage}.`,
    remaining_risk: lite.remaining_risk || "medium",
  };
}

async function handleSecretsRoutes(req, res, pathname) {
  if (req.method === "GET" && pathname === "/secrets") {
    const secrets = await loadSecrets();
    sendJson(res, 200, {
      secrets: maskSecretsForResponse(secrets),
      count: secrets.length,
    });
    return true;
  }

  if (req.method === "GET" && pathname === "/secrets/export") {
    const secrets = await loadSecrets();
    sendJson(
      res,
      200,
      { secrets },
      {
        "content-disposition": 'attachment; filename="veil-secrets.json"',
      }
    );
    return true;
  }

  if (req.method === "PUT" && pathname === "/secrets") {
    const body = await readJsonBody(req);
    if (!validateSecretsArray(body.secrets)) {
      sendJson(res, 400, { error: "invalid_secrets" });
      return true;
    }
    const saved = await replaceSecrets(body.secrets);
    sendJson(res, 200, { ok: true, count: saved.length });
    return true;
  }

  if (req.method === "POST" && pathname === "/secrets/import") {
    const body = await readJsonBody(req);
    if (!validateSecretsArray(body.secrets)) {
      sendJson(res, 400, { error: "invalid_secrets" });
      return true;
    }
    const saved = await replaceSecrets(body.secrets);
    sendJson(res, 200, {
      ok: true,
      secrets: maskSecretsForResponse(saved),
      count: saved.length,
    });
    return true;
  }

  const stageMatch = pathname.match(/^\/secrets\/([^/]+)\/stage$/);
  if (req.method === "PATCH" && stageMatch) {
    const body = await readJsonBody(req);
    try {
      const updated = await patchSecretStage(stageMatch[1], body);
      sendJson(res, 200, {
        ok: true,
        secret: maskSecretForResponse(updated),
      });
    } catch (error) {
      const code =
        error.message === "not_found"
          ? 404
          : error.message === "cannot_advance" ||
              error.message === "manual_required"
            ? 400
            : 500;
      sendJson(res, code, { error: error.message });
    }
    return true;
  }

  return false;
}

export function createServer() {
  return http.createServer(async (req, res) => {
  try {
    const pathname = parsePath(req.url || "/");

    if (req.method === "GET" && pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        name: "VEIL Sidecar",
        version: "0.0.1",
        port: PORT,
        features: [
          "health",
          "semantic_check",
          "rewrite",
          "secrets",
          "secrets_export",
          "secrets_import",
          "llm",
          "lorebook_scan",
        ],
      });
      return;
    }

    if (await handleSecretsRoutes(req, res, pathname)) return;

    if (req.method === "GET" && pathname === "/llm/status") {
      sendJson(res, 200, await getLlmStatus());
      return;
    }

    if (req.method === "POST" && pathname === "/lorebook/scan") {
      const body = await readJsonBody(req);
      sendJson(res, 200, await scanLorebookEntries(body));
      return;
    }

    if (req.method === "POST" && pathname === "/semantic-check") {
      const body = await readJsonBody(req);
      sendJson(res, 200, await semanticCheck(body));
      return;
    }

    if (req.method === "POST" && pathname === "/rewrite") {
      const body = await readJsonBody(req);
      sendJson(res, 200, rewriteDraft(body));
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    sendJson(res, 500, {
      error: "internal_error",
      message: error && error.message ? error.message : "unknown",
    });
  }
  });
}

export function startServer(port = PORT, host = HOST) {
  const server = createServer();
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      console.log(`VEIL sidecar listening on http://${host}:${port}`);
      resolve(server);
    });
  });
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  startServer();
}

export { PORT, HOST };
