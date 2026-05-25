/**
 * Sync package.json version into plugin banners and bundled headers.
 * Usage: node scripts/sync-version.mjs [version]
 *   version from argv, or GITHUB_REF_NAME (v0.0.1), or package.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function resolveVersion() {
  const arg = process.argv[2];
  if (arg) return arg.replace(/^v/, "");
  const ref = process.env.GITHUB_REF_NAME || "";
  if (ref.startsWith("v")) return ref.slice(1);
  const pkg = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf8")
  );
  return pkg.version;
}

function setBannerVersion(filePath, version) {
  let text = readFileSync(filePath, "utf8");
  if (/\/\/@version\s+/m.test(text)) {
    text = text.replace(/\/\/@version\s+[^\n]+/, `//@version ${version}`);
  } else {
    text = text.replace(
      /(\/\/@name[^\n]+\n)/,
      `$1//@version ${version}\n`
    );
  }
  writeFileSync(filePath, text);
}

const version = resolveVersion();
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

setBannerVersion(path.join(root, "lite/banner.txt"), version);
setBannerVersion(path.join(root, "full/plugin/banner.txt"), version);

const sidecarPkgPath = path.join(root, "full/sidecar/package.json");
const sidecarPkg = JSON.parse(readFileSync(sidecarPkgPath, "utf8"));
sidecarPkg.version = version;
writeFileSync(sidecarPkgPath, JSON.stringify(sidecarPkg, null, 2) + "\n");

console.log(
  `Synced version ${version} to package.json, banners, and full/sidecar/package.json`
);
