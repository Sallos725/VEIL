import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { heuristicLorebookScan } from "../shared/lorebook/heuristic-scan.js";

describe("heuristic lorebook scan", () => {
  it("proposes secrets from spoiler-like sentences", () => {
    const result = heuristicLorebookScan(
      [
        {
          id: "e1",
          loreTitle: "Kingdom",
          sourceLayer: "globalLore",
          source: "Kingdom",
          sourceType: "lorebook",
          sourceName: "Test",
          sourceId: "test",
          text: "She smiled. But in truth she already knew the secret of the kingdom.",
        },
      ],
      { default_stage: "hint" }
    );
    assert.equal(result.proposals.length, 1);
    assert.equal(result.method, "heuristic");
    assert.equal(result.proposals[0].title, "Kingdom");
    assert.ok(result.proposals[0].fullSecret.includes("secret of the kingdom"));
  });
});
