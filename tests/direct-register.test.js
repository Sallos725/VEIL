import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loreEntryToVeilSecret } from "../shared/lorebook/direct-register.js";

describe("lore direct register", () => {
  it("maps one lore entry to one secret without splitting", () => {
    const binding = {
      bindKey: "0:1",
      charIndex: 0,
      chatIndex: 1,
      characterId: "cha1",
      characterName: "Test",
      chatLabel: "Chat",
      label: "Test · Chat",
    };
    const entry = {
      id: "cha1:globalLore:0",
      loreTitle: "Kingdom Secret",
      loreKeys: "kingdom,throne",
      sourceLayer: "globalLore",
      text: "The entire hidden truth about the kingdom in one lore entry block.",
    };
    const secret = loreEntryToVeilSecret(entry, binding, { defaultStage: "hint" });
    assert.equal(secret.bindKey, "0:1");
    assert.equal(secret.title, "Kingdom Secret");
    assert.ok(secret.fullSecret.includes("entire hidden truth"));
    assert.equal(secret.revealStage, "hint");
    assert.ok(secret.hardBlocks.includes("kingdom"));
  });
});
