const MODE_ENUM = ["ic", "ooc", "narrator", "system", "debug"];
const STAGE_ENUM = [
  "sealed",
  "foreshadow",
  "hint",
  "partial",
  "near_reveal",
  "revealed",
];

export const BASE_TOOLS = [
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
        mode: { type: "string", enum: MODE_ENUM },
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
        mode: { type: "string", enum: MODE_ENUM },
        sidecar_url: { type: "string" },
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
        target_stage: { type: "string", enum: STAGE_ENUM },
        speaker_id: { type: "string" },
        listener_ids: { type: "array", items: { type: "string" } },
        mode: { type: "string", enum: MODE_ENUM },
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
        new_stage: { type: "string", enum: STAGE_ENUM },
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
        mode: { type: "string", enum: MODE_ENUM },
      },
    },
  },
];

export const LITE_EXTRA_TOOLS = [
  {
    name: "check_sidecar_status",
    description: "Lite always reports that no sidecar is enabled.",
    inputSchema: { type: "object", properties: {} },
  },
];

export const FULL_EXTRA_TOOLS = [
  {
    name: "check_sidecar_status",
    description:
      "Checks whether the optional VEIL sidecar is reachable on localhost.",
    inputSchema: {
      type: "object",
      properties: { sidecar_url: { type: "string" } },
    },
  },
];
