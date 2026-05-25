import * as esbuild from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const targets = [
  {
    entry: path.join(root, "lite/entry.js"),
    outfile: path.join(root, "lite/veil-lite.js"),
    banner: readFileSync(path.join(root, "lite/banner.txt"), "utf8"),
  },
  {
    entry: path.join(root, "full/plugin/entry.js"),
    outfile: path.join(root, "full/plugin/veil-full.js"),
    banner: readFileSync(path.join(root, "full/plugin/banner.txt"), "utf8"),
  },
];

for (const target of targets) {
  await esbuild.build({
    entryPoints: [target.entry],
    outfile: target.outfile,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    banner: { js: target.banner },
    footer: {
      js: "\n// Bundled by scripts/bundle.mjs — edit lite/entry.js or full/plugin/entry.js and run npm run bundle",
    },
  });
  console.log(`Bundled ${path.relative(root, target.outfile)}`);
}
