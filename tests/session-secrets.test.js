import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  exportSessionSecrets,
  parseSessionImportPayload,
  mergeSessionImport,
} from "../shared/storage/session-secrets.js";

const viewBinding = {
  bindKey: "cid:c1:chat-1",
  bindKeyLegacy: "0:0",
  matchKeys: ["cid:c1:chat-1", "0:0"],
  chatSessionId: "chat-1",
  charIndex: 0,
  chatIndex: 0,
  characterId: "c1",
  characterName: "A",
  chatLabel: "Main",
  label: "A · Main",
};

describe("session secrets io", () => {
  it("exportSessionSecrets scopes to binding", () => {
    const secrets = [
      { id: "a", bindKey: "cid:c1:chat-1", revealStage: "hint" },
      { id: "b", bindKey: "0:1", revealStage: "sealed" },
    ];
    const payload = exportSessionSecrets(secrets, viewBinding);
    assert.equal(payload.secrets.length, 1);
    assert.equal(payload.secrets[0].id, "a");
    assert.equal(payload.veilSessionExport, "1");
  });

  it("mergeSessionImport replace removes old session secrets", () => {
    const all = [
      { id: "old", bindKey: "cid:c1:chat-1", revealStage: "hint" },
      { id: "other", bindKey: "0:1", revealStage: "sealed" },
    ];
    const result = mergeSessionImport({
      allSecrets: all,
      imported: [{ id: "new", title: "N", revealStage: "foreshadow" }],
      viewBinding,
      mode: "replace",
    });
    assert.equal(result.removed, 1);
    assert.equal(result.added, 1);
    assert.equal(all.length, 2);
    assert.ok(all.some((s) => s.id === "new"));
    assert.ok(all.some((s) => s.id === "other"));
    assert.ok(!all.some((s) => s.id === "old"));
  });

  it("parseSessionImportPayload accepts array or envelope", () => {
    assert.equal(parseSessionImportPayload([{ id: "x", revealStage: "hint" }]).ok, true);
    assert.equal(
      parseSessionImportPayload({
        veilSessionExport: "1",
        secrets: [{ id: "y", revealStage: "sealed" }],
      }).ok,
      true
    );
  });
});
