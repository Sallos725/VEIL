import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  countMigratableToCid,
  migrateIndexSecretsToCid,
} from "../shared/chat-migration.js";

describe("chat migration", () => {
  const character = {
    chaId: "char-1",
    name: "Mira",
    chats: [
      { name: "First", id: "sess-a" },
      { name: "Second", id: "sess-b" },
    ],
  };

  it("countMigratableToCid finds index-bound secrets when chat.id exists", () => {
    const secrets = [
      { id: "s1", bindKey: "0:1", scopeType: "chat", scopeId: "0:1" },
      { id: "s2", bindKey: "cid:char-1:sess-a", scopeType: "chat", scopeId: "cid:char-1:sess-a" },
    ];
    assert.equal(countMigratableToCid(secrets, character, 0), 1);
  });

  it("migrateIndexSecretsToCid rebinds to cid keys", () => {
    const secrets = [
      { id: "s1", title: "A", bindKey: "0:1", scopeType: "chat", scopeId: "0:1" },
    ];
    const result = migrateIndexSecretsToCid(secrets, character, 0);
    assert.equal(result.migrated, 1);
    assert.equal(secrets[0].bindKey, "cid:char-1:sess-b");
    assert.equal(secrets[0].bindKeyLegacy, "0:1");
    assert.equal(secrets[0].chatSessionId, "sess-b");
  });
});
