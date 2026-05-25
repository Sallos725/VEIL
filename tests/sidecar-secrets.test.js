import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { cloneSampleSecrets } from "../shared/sample-secrets.js";

describe("sidecar secrets API", () => {
  let server;
  let baseUrl;
  let tmpDir;
  let createServer;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "veil-test-"));
    process.env.VEIL_DATA_DIR = tmpDir;
    const mod = await import("../full/sidecar/src/server.js");
    createServer = mod.createServer;
    server = await mod.startServer(0, "127.0.0.1");
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("GET /health includes secrets feature", async () => {
    const res = await fetch(`${baseUrl}/health`);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.ok(data.features.includes("secrets"));
  });

  it("OPTIONS /health returns 204 with CORS headers", async () => {
    const res = await fetch(`${baseUrl}/health`, {
      method: "OPTIONS",
      headers: { Origin: "https://risu.example", "Access-Control-Request-Method": "GET" },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
    assert.match(
      res.headers.get("access-control-allow-methods") || "",
      /GET/
    );
  });

  it("PUT and GET /secrets roundtrip", async () => {
    const secrets = cloneSampleSecrets();
    secrets[0].revealStage = "partial";

    const putRes = await fetch(`${baseUrl}/secrets`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secrets }),
    });
    assert.equal(putRes.ok, true);

    const getRes = await fetch(`${baseUrl}/secrets`);
    const data = await getRes.json();
    assert.equal(data.secrets.length, secrets.length);
    assert.equal(data.secrets[0].revealStage, "partial");
    assert.equal(data.secrets[0].fullSecret, null);
  });

  it("PATCH /secrets/:id/stage advances stage", async () => {
    const secrets = cloneSampleSecrets();
    await fetch(`${baseUrl}/secrets`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secrets }),
    });

    const patchRes = await fetch(
      `${baseUrl}/secrets/${secrets[0].id}/stage`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          new_stage: "partial",
          manual: true,
          reason: "test",
        }),
      }
    );
    assert.equal(patchRes.ok, true);
    const patched = await patchRes.json();
    assert.equal(patched.secret.revealStage, "partial");
  });

  it("createServer export works", () => {
    assert.equal(typeof createServer, "function");
  });
});
