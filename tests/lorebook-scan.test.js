import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scanLorebookEntries } from "../full/sidecar/src/lorebook-scan.js";

describe("lorebook scan handler", () => {
  it("returns error when no entries", async () => {
    const result = await scanLorebookEntries({ entries: [] });
    assert.equal(result.proposals.length, 0);
    assert.equal(result.error, "no_entries");
  });

  it("returns llm_failed when llm not reachable", async () => {
    const result = await scanLorebookEntries({
      entries: [
        {
          source: "character:test",
          sourceType: "character",
          sourceName: "Test",
          text: "Hidden truth about the kingdom.",
        },
      ],
      llm: { baseUrl: "http://127.0.0.1:59999/v1", model: "none" },
    });
    assert.equal(result.llm_used, false);
    assert.ok(result.error);
  });
});
