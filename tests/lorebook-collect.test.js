import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collectLoreEntries,
  collectLorebookEntriesForCharacter,
} from "../shared/lorebook/collectFromDatabase.js";

describe("lorebook collect", () => {
  it("extracts character lorebook entries", () => {
    const db = {
      characters: [
        {
          chaId: "char_a",
          name: "Alice",
          description: "A traveler with a hidden past.",
          lorebook: [
            { key: "secret_past", content: "Alice once betrayed the guild." },
          ],
        },
      ],
      personas: [],
      modules: [],
    };

    const entries = collectLoreEntries(db);
    assert.ok(entries.length >= 2);
    assert.ok(entries.some((e) => e.text.includes("betrayed")));
    assert.ok(entries.some((e) => e.sourceType === "character"));
  });

  it("returns empty for null db", () => {
    assert.deepEqual(collectLoreEntries(null), []);
  });

  it("collectLorebookEntriesForCharacter reads RisuAI globalLore and localLore", () => {
    const db = {
      characters: [
        {
          chaId: "c1",
          name: "Yuki",
          firstMessage:
            "Hello this is only the first message and should not appear in lore scan.",
          desc: "Character description that should not appear in lore-only scan.",
          globalLore: [
            {
              key: "kingdom,secret",
              content: "Hidden truth about the kingdom and the old pact.",
              comment: "Kingdom Secret",
              mode: "normal",
            },
          ],
          chats: [
            {
              name: "Chat 1",
              message: [],
              note: "",
              localLore: [
                {
                  key: "local",
                  content: "Chat-specific override lore for this session only.",
                  comment: "Session Override",
                  mode: "normal",
                },
              ],
            },
          ],
        },
      ],
    };

    const entries = collectLorebookEntriesForCharacter(db, 0, 0);
    assert.equal(entries.length, 2);
    assert.ok(entries.some((e) => e.loreTitle === "Kingdom Secret"));
    assert.ok(entries.some((e) => e.loreTitle === "Session Override"));
    assert.ok(entries.every((e) => e.sourceType === "lorebook"));
    assert.ok(entries.every((e) => e.text === entries.find((x) => x.id === e.id).text));
    assert.ok(!entries.some((e) => e.text.includes("first message")));
    assert.ok(!entries.some((e) => e.text.includes("description")));
  });

  it("collectLorebookEntriesForCharacter scopes to one bot", () => {
    const db = {
      characters: [
        {
          chaId: "a",
          name: "Alice",
          globalLore: [
            {
              key: "a",
              content: "Alice global lore entry text here.",
              mode: "normal",
            },
          ],
        },
        {
          chaId: "b",
          name: "Bob",
          globalLore: [
            {
              key: "b",
              content: "Bob global lore entry text here.",
              mode: "normal",
            },
          ],
        },
      ],
    };
    const aliceOnly = collectLorebookEntriesForCharacter(db, 0);
    assert.ok(aliceOnly.every((e) => e.sourceName === "Alice"));
    assert.ok(aliceOnly.some((e) => e.text.includes("Alice")));
    assert.ok(!aliceOnly.some((e) => e.text.includes("Bob")));
  });

  it("skips folder-mode lore entries without content", () => {
    const db = {
      characters: [
        {
          chaId: "c1",
          name: "Test",
          globalLore: [
            { mode: "folder", content: "", comment: "Folder Only" },
            {
              key: "x",
              content: "Real lore content for scanning purposes.",
              mode: "normal",
            },
          ],
        },
      ],
    };
    const entries = collectLorebookEntriesForCharacter(db, 0);
    assert.equal(entries.length, 1);
    assert.ok(entries[0].text.includes("Real lore"));
  });

  it("chunks long text", () => {
    const longText = "x".repeat(5000);
    const db = {
      characters: [{ chaId: "c1", name: "Bob", personality: longText }],
    };
    const entries = collectLoreEntries(db);
    assert.ok(entries.length >= 2);
  });
});
