import http from "node:http";
import { normalizeText } from "../../../shared/text.js";

const PORT = 8787;
const HOST = "127.0.0.1";

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

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": `http://${HOST}:${PORT}`,
  });
  res.end(JSON.stringify(payload));
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

function semanticCheck(payload) {
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
    if (draftNorm.includes(normalizeText(phrase)) && overlapScore(draft, phrase) > 0.4) {
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

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, {
        ok: true,
        name: "VEIL Sidecar",
        version: "0.1.0",
        features: ["health", "semantic_check", "rewrite"],
      });
      return;
    }

    if (req.method === "POST" && req.url === "/semantic-check") {
      const body = await readJsonBody(req);
      sendJson(res, 200, semanticCheck(body));
      return;
    }

    if (req.method === "POST" && req.url === "/rewrite") {
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

server.listen(PORT, HOST, () => {
  console.log(`VEIL sidecar listening on http://${HOST}:${PORT}`);
});
