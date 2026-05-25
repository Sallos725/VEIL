import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getLlmConfig,
  isLlmConfigured,
} from "../full/sidecar/src/llm-client.js";

describe("llm client config", () => {
  it("reads config from env", () => {
    const prev = process.env.VEIL_LLM_MODEL;
    process.env.VEIL_LLM_MODEL = "test-model";
    const cfg = getLlmConfig();
    assert.equal(cfg.model, "test-model");
    process.env.VEIL_LLM_MODEL = prev;
  });

  it("is configured when base and model exist", () => {
    assert.equal(
      isLlmConfigured({ baseUrl: "http://127.0.0.1:11434/v1", model: "m" }),
      true
    );
    assert.equal(isLlmConfigured({ baseUrl: "", model: "m" }), false);
  });
});
