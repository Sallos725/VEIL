import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getSidecarUrl } from "../shared/sidecar-client.js";

describe("sidecar client", () => {
  it("uses default localhost url", () => {
    assert.equal(getSidecarUrl(), "http://127.0.0.1:6010");
  });

  it("respects custom url", () => {
    assert.equal(
      getSidecarUrl("http://127.0.0.1:9999"),
      "http://127.0.0.1:9999"
    );
  });
});
