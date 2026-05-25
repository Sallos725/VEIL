import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createPluginStore, validateSecrets } from "../shared/storage/pluginStore.js";
import { cloneSampleSecrets } from "../shared/sample-secrets.js";

function createMockStorage() {
  const map = new Map();
  return {
    async getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async setItem(key, value) {
      map.set(key, JSON.parse(JSON.stringify(value)));
    },
    async removeItem(key) {
      map.delete(key);
    },
    async keys() {
      return [...map.keys()];
    },
    async clear() {
      map.clear();
    },
  };
}

describe("plugin store", () => {
  let mockStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
  });

  it("loads sample secrets when storage empty", async () => {
    const store = createPluginStore({
      Risuai: { getLocalPluginStorage: async () => mockStorage },
    });
    const loaded = await store.load();
    assert.ok(loaded.secrets.length > 0);
    assert.equal(loaded.source, "sample");
  });

  it("persists secrets to plugin storage", async () => {
    const store = createPluginStore({
      Risuai: { getLocalPluginStorage: async () => mockStorage },
    });
    const loaded = await store.load();
    loaded.secrets[0].revealStage = "partial";
    await store.save(loaded.secrets);

    const store2 = createPluginStore({
      Risuai: { getLocalPluginStorage: async () => mockStorage },
    });
    const again = await store2.load();
    assert.equal(again.secrets[0].revealStage, "partial");
    assert.equal(again.source, "pluginStorage");
  });

  it("validates import secrets", async () => {
    const store = createPluginStore({
      Risuai: { getLocalPluginStorage: async () => mockStorage },
    });
    const bad = await store.importSecrets([{ nope: true }]);
    assert.equal(bad.ok, false);
    const good = await store.importSecrets(cloneSampleSecrets());
    assert.equal(good.ok, true);
    assert.equal(validateSecrets(cloneSampleSecrets()), true);
  });
});
