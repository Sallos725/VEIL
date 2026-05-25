import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cloneSampleSecrets } from "../shared/sample-secrets.js";
import { attachChatBinding } from "../shared/chat-binding.js";
import {
  extractLastUserMessage,
  matchSecretsForUserInput,
  buildVeilGuidanceBlock,
  pickTargetStageFromViolations,
  prependVeilSystemMessage,
} from "../shared/risu-replacers.js";
import { checkDisclosure } from "../shared/core.js";
import { normalizeRpSettings } from "../shared/storage/rp-settings-store.js";

describe("risu replacers", () => {
  it("extractLastUserMessage finds last user role", () => {
    const text = extractLastUserMessage([
      { role: "system", content: "sys" },
      { role: "assistant", content: "hi" },
      { role: "user", content: "old incident" },
    ]);
    assert.equal(text, "old incident");
  });

  it("matchSecretsForUserInput matches tags in user text", () => {
    const secrets = cloneSampleSecrets();
    const binding = {
      bindKey: "cid:1:chat1",
      characterId: "sample_character",
      charIndex: 0,
      chatIndex: 0,
      characterName: "Sample",
      chatLabel: "Chat",
      label: "Sample · Chat",
      matchKeys: ["cid:1:chat1"],
    };
    const scoped = secrets.map((s) => attachChatBinding(s, binding));
    const matched = matchSecretsForUserInput(scoped, "talk about the old incident");
    assert.ok(matched.some((s) => s.id === "sample_hidden_truth"));
  });

  it("buildVeilGuidanceBlock omits fullSecret and includes allowed disclosures", () => {
    const secrets = cloneSampleSecrets();
    const block = buildVeilGuidanceBlock(secrets.slice(0, 1), {
      mode: "ic",
      speaker_id: "sample_character",
    });
    assert.ok(block.startsWith("[VEIL]"));
    assert.ok(block.includes("old incident"));
    assert.ok(!block.includes("already knows the truth and hid"));
    assert.ok(block.includes("hardBlocks"));
  });

  it("prependVeilSystemMessage adds system block", () => {
    const out = prependVeilSystemMessage(
      [{ role: "user", content: "hi" }],
      "[VEIL] test"
    );
    assert.equal(out.length, 2);
    assert.equal(out[0].role, "system");
    assert.ok(String(out[0].content).startsWith("[VEIL]"));
  });

  it("pickTargetStageFromViolations uses most conservative stage", () => {
    const secrets = cloneSampleSecrets();
    const stage = pickTargetStageFromViolations(
      [
        { secret_id: "sample_hidden_truth", current_stage: "hint" },
        { secret_id: "persona_private_note", current_stage: "foreshadow" },
      ],
      secrets
    );
    assert.equal(stage, "foreshadow");
  });

  it("normalizeRpSettings defaults enabled and redact on", () => {
    const s = normalizeRpSettings({});
    assert.equal(s.enabled, true);
    assert.equal(s.enforceRedact, true);
    assert.equal(s.injectGuidance, true);
  });

  it("checkDisclosure flags hardBlock before redact path", () => {
    const secrets = cloneSampleSecrets();
    const sample = secrets[0];
    const result = checkDisclosure(
      "She said already knows the truth today.",
      { mode: "ic", speaker_id: "sample_character" },
      [sample]
    );
    assert.equal(result.safe, false);
    assert.ok(result.violations.length > 0);
  });
});
