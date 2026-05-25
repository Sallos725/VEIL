import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildVertexOpenAiBaseUrl,
  parseVertexProjectId,
  isLlmSettingsConfigured,
  settingsToLlmRaw,
} from "../shared/llm/providers.js";
import { normalizeLlmSettings } from "../shared/storage/llmSettingsStore.js";

describe("llm providers", () => {
  it("buildVertexOpenAiBaseUrl includes project and location", () => {
    const url = buildVertexOpenAiBaseUrl("my-proj", "asia-northeast3");
    assert.ok(url.includes("my-proj"));
    assert.ok(url.includes("asia-northeast3"));
    assert.ok(url.endsWith("/endpoints/openapi"));
  });

  it("parseVertexProjectId reads project_id from JSON", () => {
    const id = parseVertexProjectId(
      JSON.stringify({ project_id: "abc-123", client_email: "x@y" })
    );
    assert.equal(id, "abc-123");
  });

  it("isLlmSettingsConfigured allows custom without api key", () => {
    const raw = settingsToLlmRaw(
      normalizeLlmSettings({
        providerId: "custom",
        baseUrl: "http://127.0.0.1:11434/v1",
        model: "llama3.2",
      })
    );
    assert.equal(isLlmSettingsConfigured(raw), true);
  });

  it("vertex requires json", () => {
    const raw = settingsToLlmRaw(
      normalizeLlmSettings({
        providerId: "vertex",
        model: "gemini-2.0-flash",
        baseUrl: buildVertexOpenAiBaseUrl("p"),
      })
    );
    assert.equal(isLlmSettingsConfigured(raw), false);
  });
});
