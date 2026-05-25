/**
 * Run all tests/*.test.js (CI-safe; no shell glob required).
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const testsDir = path.join(root, "tests");
const files = readdirSync(testsDir)
  .filter((name) => name.endsWith(".test.js"))
  .map((name) => path.join(testsDir, name))
  .sort();

if (files.length === 0) {
  console.error("No test files found in tests/");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
  cwd: root,
});

process.exit(result.status ?? 1);
