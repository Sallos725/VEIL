import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getAllowedDisclosures,
  advanceRevealStage,
  listActiveSecrets,
} from "../shared/core.js";
import { cloneSampleSecrets, VEIL_SAMPLE_SECRETS } from "../shared/sample-secrets.js";
import { canAdvanceTo, isValidStage } from "../shared/revealStages.js";

describe("reveal stages", () => {
  it("sealed secrets return no disclosures", () => {
    const secret = {
      ...VEIL_SAMPLE_SECRETS[0],
      revealStage: "sealed",
      revealLadder: { hint: ["should not appear"] },
    };
    assert.deepEqual(getAllowedDisclosures(secret), []);
  });

  it("foreshadow returns only foreshadow ladder", () => {
    const secret = {
      ...VEIL_SAMPLE_SECRETS[0],
      revealStage: "foreshadow",
    };
    const disclosures = getAllowedDisclosures(secret);
    assert.ok(disclosures.length > 0);
    assert.ok(
      disclosures.every((d) =>
        secret.revealLadder.foreshadow.includes(d)
      )
    );
  });

  it("hint stage includes foreshadow and hint only", () => {
    const secret = { ...VEIL_SAMPLE_SECRETS[0], revealStage: "hint" };
    const disclosures = getAllowedDisclosures(secret);
    assert.ok(
      secret.revealLadder.hint.every((line) => disclosures.includes(line))
    );
    assert.ok(
      !disclosures.includes(secret.revealLadder.partial[0])
    );
  });

  it("revealed stage omits fullSecret without permission context", () => {
    const secret = { ...VEIL_SAMPLE_SECRETS[0], revealStage: "revealed" };
    const disclosures = getAllowedDisclosures(secret, {
      speaker_id: "sample_listener",
      listener_ids: ["sample_listener"],
      mode: "ic",
    });
    assert.ok(!disclosures.includes(secret.fullSecret));
  });

  it("advance_reveal_stage requires manual true", () => {
    const secrets = cloneSampleSecrets();
    const result = advanceRevealStage(secrets, secrets[0].id, "partial", {
      manual: false,
    });
    assert.equal(result.ok, false);
  });

  it("advance_reveal_stage moves forward only", () => {
    const secrets = cloneSampleSecrets();
    const ok = advanceRevealStage(secrets, secrets[0].id, "partial", {
      manual: true,
      reason: "test",
    });
    assert.equal(ok.ok, true);
    assert.equal(secrets[0].revealStage, "partial");

    const backward = advanceRevealStage(secrets, secrets[0].id, "hint", {
      manual: true,
    });
    assert.equal(backward.ok, false);
  });

  it("list_active_secrets masks sealed titles outside debug", () => {
    const secrets = cloneSampleSecrets();
    secrets[0].revealStage = "sealed";
    const listed = listActiveSecrets(secrets, { mode: "ic" });
    assert.equal(listed.secrets[0].title, "[sealed]");
  });

  it("stage helpers validate order", () => {
    assert.equal(isValidStage("hint"), true);
    assert.equal(canAdvanceTo("hint", "partial"), true);
    assert.equal(canAdvanceTo("partial", "hint"), false);
  });
});
