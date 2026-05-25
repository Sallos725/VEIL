import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolvePluginOptions } from "../shared/plugin-options.js";

function createStore(settings) {
  return {
    async load() {
      return settings;
    },
  };
}

describe("plugin options", () => {
  it("uses saved sidecar URL before plugin argument", async () => {
    const opts = await resolvePluginOptions(
      {
        async getArgument(name) {
          assert.equal(name, "sidecar_url");
          return "http://veil:6010";
        },
      },
      { sidecarUrl: "http://127.0.0.1:6010" },
      createStore({ sidecarUrl: "https://risu.example.test/veil" })
    );

    assert.equal(opts.sidecarUrl, "https://risu.example.test/veil");
  });

  it("uses plugin argument when no sidecar URL is saved", async () => {
    const opts = await resolvePluginOptions(
      {
        async getArgument() {
          return "http://server.test:6010";
        },
      },
      { sidecarUrl: "http://127.0.0.1:6010" },
      createStore({})
    );

    assert.equal(opts.sidecarUrl, "http://server.test:6010");
  });
});
