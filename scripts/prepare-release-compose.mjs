/**
 * Write full/docker-compose.release.yml for a tagged GHCR image.
 * Usage: node scripts/prepare-release-compose.mjs [tag]
 *   tag defaults to GITHUB_REF_NAME (v0.0.1) or "latest"
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const owner =
  process.env.GITHUB_REPOSITORY_OWNER ||
  process.env.VEIL_GHCR_OWNER ||
  "Sallos725";
const tag =
  process.argv[2] ||
  process.env.GITHUB_REF_NAME ||
  process.env.VEIL_IMAGE_TAG ||
  "latest";

const image = `ghcr.io/${owner.toLowerCase()}/veil-sidecar:${tag}`;

const templatePath = path.join(root, "full/docker-compose.release.yml.template");
const outPath = path.join(root, "full/docker-compose.release.yml");

let text = readFileSync(templatePath, "utf8");
text = text.replaceAll("__VEIL_IMAGE__", image);
writeFileSync(outPath, text);
console.log(`Wrote ${outPath} with image ${image}`);
