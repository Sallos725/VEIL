import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkDisclosure,
  redactToAllowedStage,
} from "../shared/core.js";
import { cloneSampleSecrets } from "../shared/sample-secrets.js";

describe("disclosure check", () => {
  const secrets = cloneSampleSecrets();
  const sample = secrets[0];

  it("detects premature fullSecret reveal", () => {
    const result = checkDisclosure(sample.fullSecret, { mode: "ic" }, secrets);
    assert.equal(result.safe, false);
    assert.ok(
      result.violations.some((v) =>
        v.reason.includes("fullSecret")
      )
    );
  });

  it("detects hardBlocks before revealed stage", () => {
    const result = checkDisclosure(
      "She already knows the truth and is hiding it to protect everyone.",
      { speaker_id: "sample_character", mode: "ic" },
      secrets
    );
    assert.equal(result.safe, false);
    assert.ok(
      result.violations.some((v) => v.reason.includes("hard-blocked"))
    );
  });

  it("blocks unknown speaker from stating full secret", () => {
    const result = checkDisclosure(sample.fullSecret, {
      speaker_id: "sample_listener",
      mode: "ic",
    }, secrets);
    assert.equal(result.safe, false);
  });

  it("blocks persona secret in IC character dialogue", () => {
    const personaSecret = secrets.find((s) => s.scopeType === "persona");
    const result = checkDisclosure(personaSecret.fullSecret, {
      speaker_id: "sample_character",
      persona_id: "sample_persona",
      listener_ids: ["sample_persona"],
      mode: "ic",
    }, secrets);
    assert.equal(result.safe, false);
    assert.ok(
      result.violations.some((v) =>
        v.reason.includes("Persona-private")
      )
    );
  });

  it("redact removes hardBlocked phrases", () => {
    const draft =
      "She already knows the truth and is hiding it to protect everyone.";
    const result = redactToAllowedStage(draft, "hint", secrets);
    assert.ok(!result.redacted_text.includes("already knows the truth"));
    assert.ok(result.redacted_text.includes("[…]"));
  });
});
