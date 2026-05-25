import { cloneSampleSecrets } from "../../shared/sample-secrets.js";
import {
  makeGuidance,
  checkDisclosure,
  redactToAllowedStage,
  advanceRevealStage,
  listActiveSecrets,
} from "../../shared/core.js";
import {
  checkSidecarHealth,
  requestSemanticCheck,
  requestRewrite,
  getSidecarUrl,
} from "../../shared/sidecar-client.js";

const veilSecrets = cloneSampleSecrets();
const VEIL_SIDECAR_URL = "http://127.0.0.1:8787";

function jsonResult(value) {
  return [{ type: "text", text: JSON.stringify(value, null, 2) }];
}

const fullTools = [
  {
    name: "get_reveal_guidance",
    description:
      "Returns stage-appropriate guidance for foreshadowing, hints, partial reveals, or full reveals without spoiling secrets early.",
    inputSchema: {
      type: "object",
      properties: {
        user_input: { type: "string" },
        speaker_id: { type: "string" },
        listener_ids: { type: "array", items: { type: "string" } },
        persona_id: { type: "string" },
        scene_tags: { type: "array", items: { type: "string" } },
        active_flags: { type: "array", items: { type: "string" } },
        mode: {
          type: "string",
          enum: ["ic", "ooc", "narrator", "system", "debug"],
        },
      },
      required: ["user_input"],
    },
  },
  {
    name: "check_disclosure",
    description:
      "Checks whether a draft response prematurely reveals hidden secrets. Uses sidecar when available; always runs Lite checks.",
    inputSchema: {
      type: "object",
      properties: {
        draft_text: { type: "string" },
        speaker_id: { type: "string" },
        listener_ids: { type: "array", items: { type: "string" } },
        persona_id: { type: "string" },
        scene_tags: { type: "array", items: { type: "string" } },
        active_flags: { type: "array", items: { type: "string" } },
        mode: {
          type: "string",
          enum: ["ic", "ooc", "narrator", "system", "debug"],
        },
        sidecar_url: { type: "string" },
      },
      required: ["draft_text"],
    },
  },
  {
    name: "redact_to_allowed_stage",
    description:
      "Redacts a draft to a target reveal stage. May request sidecar rewrite assistance when available.",
    inputSchema: {
      type: "object",
      properties: {
        draft_text: { type: "string" },
        target_stage: {
          type: "string",
          enum: [
            "sealed",
            "foreshadow",
            "hint",
            "partial",
            "near_reveal",
            "revealed",
          ],
        },
        sidecar_url: { type: "string" },
      },
      required: ["draft_text", "target_stage"],
    },
  },
  {
    name: "advance_reveal_stage",
    description:
      "Moves a secret to a later reveal stage when narrative conditions are met (manual only).",
    inputSchema: {
      type: "object",
      properties: {
        secret_id: { type: "string" },
        new_stage: {
          type: "string",
          enum: [
            "sealed",
            "foreshadow",
            "hint",
            "partial",
            "near_reveal",
            "revealed",
          ],
        },
        reason: { type: "string" },
        manual: { type: "boolean" },
      },
      required: ["secret_id", "new_stage", "manual"],
    },
  },
  {
    name: "list_active_secrets",
    description:
      "Lists non-sensitive metadata about active secrets for debugging or user management.",
    inputSchema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["ic", "ooc", "narrator", "system", "debug"],
        },
      },
    },
  },
  {
    name: "check_sidecar_status",
    description:
      "Checks whether the optional VEIL sidecar is reachable on localhost.",
    inputSchema: {
      type: "object",
      properties: {
        sidecar_url: { type: "string" },
      },
    },
  },
];

function mergeDisclosureResults(liteResult, sidecarData) {
  if (!sidecarData || !sidecarData.violations) return liteResult;

  const merged = [...liteResult.violations, ...sidecarData.violations];
  const seen = new Set();
  const violations = merged.filter((v) => {
    const key = `${v.secret_id}:${v.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    safe: violations.length === 0,
    risk_level: violations.length === 0 ? "none" : liteResult.risk_level,
    violations,
    sidecar_assisted: true,
  };
}

async function handleFullTool(toolName, content) {
  const ctx = content || {};
  const sidecarUrl = getSidecarUrl(ctx.sidecar_url || VEIL_SIDECAR_URL);

  switch (toolName) {
    case "get_reveal_guidance":
      return jsonResult(makeGuidance(ctx.user_input || "", ctx, veilSecrets));
    case "check_disclosure": {
      const liteResult = checkDisclosure(
        ctx.draft_text || "",
        ctx,
        veilSecrets
      );
      const sidecar = await requestSemanticCheck(
        {
          draft_text: ctx.draft_text || "",
          context: ctx,
          lite_result: liteResult,
        },
        sidecarUrl
      );

      if (sidecar.ok && sidecar.data) {
        return jsonResult(mergeDisclosureResults(liteResult, sidecar.data));
      }
      return jsonResult({ ...liteResult, sidecar_assisted: false });
    }
    case "redact_to_allowed_stage": {
      const liteRedaction = redactToAllowedStage(
        ctx.draft_text || "",
        ctx.target_stage || "hint",
        veilSecrets
      );
      const sidecar = await requestRewrite(
        {
          draft_text: ctx.draft_text || "",
          target_stage: ctx.target_stage || "hint",
          lite_result: liteRedaction,
        },
        sidecarUrl
      );

      if (sidecar.ok && sidecar.data && sidecar.data.redacted_text) {
        return jsonResult({
          ...liteRedaction,
          redacted_text: sidecar.data.redacted_text,
          explanation:
            sidecar.data.explanation || liteRedaction.explanation,
          remaining_risk:
            sidecar.data.remaining_risk || liteRedaction.remaining_risk,
          sidecar_assisted: true,
        });
      }
      return jsonResult({ ...liteRedaction, sidecar_assisted: false });
    }
    case "advance_reveal_stage":
      return jsonResult(
        advanceRevealStage(veilSecrets, ctx.secret_id, ctx.new_stage, {
          manual: ctx.manual,
          reason: ctx.reason,
        })
      );
    case "list_active_secrets":
      return jsonResult(listActiveSecrets(veilSecrets, ctx));
    case "check_sidecar_status":
      return jsonResult(await checkSidecarHealth(sidecarUrl));
    default:
      return [{ type: "text", text: "Unknown VEIL Full tool: " + toolName }];
  }
}

async function registerVeilFull() {
  if (typeof Risuai === "undefined" || !Risuai.registerMCP) {
    console.log("[VEIL Full] Risuai.registerMCP is not available.");
    return;
  }

  await Risuai.registerMCP(
    {
      identifier: "plugin:veil-full",
      name: "VEIL Full",
      version: "0.1.0",
      description:
        "Visibility Enforcement & Integrity Layer with optional sidecar assistance.",
    },
    async () => fullTools,
    handleFullTool
  );

  console.log("[VEIL Full] MCP module registered.");
}

registerVeilFull();
