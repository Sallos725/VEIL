import { cloneSampleSecrets } from "../shared/sample-secrets.js";
import {
  makeGuidance,
  checkDisclosure,
  redactToAllowedStage,
  advanceRevealStage,
  listActiveSecrets,
} from "../shared/core.js";

const veilSecrets = cloneSampleSecrets();

function jsonResult(value) {
  return [{ type: "text", text: JSON.stringify(value, null, 2) }];
}

const liteTools = [
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
      "Checks whether a draft response prematurely reveals hidden character, persona, or plot secrets.",
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
      },
      required: ["draft_text"],
    },
  },
  {
    name: "redact_to_allowed_stage",
    description:
      "Returns a conservative redaction/rewrite guidance for a draft according to a target reveal stage.",
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
        speaker_id: { type: "string" },
        listener_ids: { type: "array", items: { type: "string" } },
        mode: {
          type: "string",
          enum: ["ic", "ooc", "narrator", "system", "debug"],
        },
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
    description: "Lite always reports that no sidecar is enabled.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function handleLiteTool(toolName, content) {
  const ctx = content || {};

  switch (toolName) {
    case "get_reveal_guidance":
      return jsonResult(
        makeGuidance(ctx.user_input || "", ctx, veilSecrets)
      );
    case "check_disclosure":
      return jsonResult(
        checkDisclosure(ctx.draft_text || "", ctx, veilSecrets)
      );
    case "redact_to_allowed_stage":
      return jsonResult(
        redactToAllowedStage(
          ctx.draft_text || "",
          ctx.target_stage || "hint",
          veilSecrets
        )
      );
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
      return jsonResult({
        enabled: false,
        reachable: false,
        features: [],
      });
    default:
      return [{ type: "text", text: "Unknown VEIL Lite tool: " + toolName }];
  }
}

async function registerVeilLite() {
  if (typeof Risuai === "undefined" || !Risuai.registerMCP) {
    console.log("[VEIL Lite] Risuai.registerMCP is not available.");
    return;
  }

  await Risuai.registerMCP(
    {
      identifier: "plugin:veil-lite",
      name: "VEIL Lite",
      version: "0.1.0",
      description:
        "Visibility Enforcement & Integrity Layer for staged secret disclosure.",
    },
    async () => liteTools,
    handleLiteTool
  );

  console.log("[VEIL Lite] MCP module registered.");
}

registerVeilLite();
