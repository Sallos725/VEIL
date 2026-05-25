/**
 * Versioned Release filenames + sidecar zip for GitHub Releases.
 * Usage: node scripts/prepare-release-assets.mjs [tag]
 */
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packageSidecarZip } from "./package-sidecar-zip.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function resolveTag() {
  const arg = process.argv[2];
  if (arg) return arg.startsWith("v") ? arg : `v${arg}`;
  const ref = process.env.GITHUB_REF_NAME || "";
  if (ref) return ref;
  throw new Error("Tag required: node scripts/prepare-release-assets.mjs v0.1.0-beta");
}

const tag = resolveTag();
const outDir = path.join(root, "dist/release");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const assets = [
  { src: "lite/veil-lite.js", name: `veil-lite-${tag}.js` },
  { src: "full/plugin/veil-full.js", name: `veil-full-${tag}.js` },
  {
    src: "full/docker-compose.release.yml",
    name: `docker-compose-${tag}.yml`,
  },
];

for (const { src, name } of assets) {
  copyFileSync(path.join(root, src), path.join(outDir, name));
  console.log(`Copied ${name}`);
}

packageSidecarZip(tag, outDir);

writeFileSync(
  path.join(outDir, "manifest.txt"),
  assets.map((a) => a.name).join("\n") +
    `\nveil-sidecar-${tag}.zip\n`,
  "utf8"
);

console.log(`Release assets in ${outDir}`);
