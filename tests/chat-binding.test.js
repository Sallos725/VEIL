import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  makeBindKey,
  filterSecretsForBinding,
  attachChatBinding,
  migrateUnboundSecretsToBinding,
  secretMatchesBinding,
  resolveChatBindingSafe,
  BINDING_REASON,
} from "../shared/chat-binding.js";

describe("chat binding", () => {
  it("makeBindKey encodes character and chat indices", () => {
    assert.equal(makeBindKey(2, 5), "2:5");
  });

  it("filterSecretsForBinding returns only matching secrets", () => {
    const secrets = [
      { id: "a", bindKey: "0:1", scopeType: "chat", scopeId: "0:1" },
      { id: "b", bindKey: "0:2", scopeType: "chat", scopeId: "0:2" },
      { id: "c", scopeType: "chat", scopeId: "0:1" },
    ];
    const filtered = filterSecretsForBinding(secrets, "0:1");
    assert.equal(filtered.length, 2);
    assert.ok(filtered.some((s) => s.id === "a"));
    assert.ok(filtered.some((s) => s.id === "c"));
  });

  it("attachChatBinding sets chat scope fields", () => {
    const binding = {
      bindKey: "1:3",
      charIndex: 1,
      chatIndex: 3,
      characterId: "char_x",
      characterName: "Test",
      chatLabel: "Chat A",
      label: "Test · Chat A",
    };
    const out = attachChatBinding({ id: "s1", title: "T" }, binding);
    assert.equal(out.bindKey, "1:3");
    assert.equal(out.scopeType, "chat");
    assert.equal(out.characterId, "char_x");
  });

  it("resolveChatBindingSafe fails gracefully without character", async () => {
    const Risuai = {
      async getCurrentCharacterIndex() {
        return 99;
      },
      async getCurrentChatIndex() {
        throw new Error("undefined is not an object (evaluating 'e.characters[t].chatPage')");
      },
      async getDatabase() {
        return { characters: [{ chaId: "c1", name: "Only", chats: [{ name: "C1" }], chatPage: 0, globalLore: [] }] };
      },
    };
    const result = await resolveChatBindingSafe(Risuai);
    assert.equal(result.ok, false);
    assert.ok(result.userMessage.length > 0);
    assert.equal(result.reason, BINDING_REASON.INVALID_CHARACTER);
  });

  it("resolveChatBindingSafe uses chatPage when getCurrentChatIndex throws", async () => {
    const Risuai = {
      async getCurrentCharacterIndex() {
        return 0;
      },
      async getCurrentChatIndex() {
        throw new Error("chatPage crash");
      },
      async getDatabase() {
        return {
          characters: [
            {
              chaId: "c1",
              name: "Yuki",
              chatPage: 0,
              chats: [{ name: "Main" }],
              globalLore: [],
            },
          ],
        };
      },
    };
    const result = await resolveChatBindingSafe(Risuai);
    assert.equal(result.ok, true);
    assert.equal(result.binding?.bindKey, "0:0");
    assert.equal(result.binding?.characterName, "Yuki");
  });

  it("migrateUnboundSecretsToBinding only when none bound", () => {
    const secrets = [{ id: "x", title: "A" }, { id: "y", title: "B" }];
    assert.equal(migrateUnboundSecretsToBinding(secrets, "0:0"), 2);
    assert.equal(secretMatchesBinding(secrets[0], "0:0"), true);
    assert.equal(migrateUnboundSecretsToBinding(secrets, "0:1"), 0);
  });
});
