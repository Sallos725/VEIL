/**
 * Zip VEIL Full sidecar runtime (sidecar + minimal shared/), not the whole repo.
 * Usage: node scripts/package-sidecar-zip.mjs [tag] [outDir]
 */
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const SHARED_RUNTIME = [
  "shared/text.js",
  "shared/sample-secrets.js",
  "shared/revealStages.js",
  "shared/lorebook/proposals.js",
  "shared/llm/prompts.js",
];

function resolveTag() {
  const arg = process.argv[2];
  if (arg) return arg.startsWith("v") ? arg : `v${arg}`;
  const ref = process.env.GITHUB_REF_NAME || "";
  if (ref) return ref;
  const pkg = JSON.parse(
    readFileSync(path.join(root, "package.json"), "utf8")
  );
  return pkg.version.startsWith("v") ? pkg.version : `v${pkg.version}`;
}

function resolveOwner() {
  return (
    process.env.GITHUB_REPOSITORY_OWNER ||
    process.env.VEIL_GHCR_OWNER ||
    "Sallos725"
  ).toLowerCase();
}

function shouldCopySidecarEntry(name) {
  if (name === "node_modules") return false;
  if (name.endsWith(".json") && name !== "package.json") return false;
  return true;
}

function writeInstallKo(stagingRoot, tag, image) {
  const text = `# VEIL Full Sidecar — ${tag}

이 ZIP은 **Full 전용 HTTP 서버**만 포함합니다 (플러그인 \`veil-full-${tag}.js\`는 Release에서 별도 받으세요).

## 빠른 시작 (Node 20+)

\`\`\`bash
# 압축 해제 후 ZIP 루트에서
./full/sidecar/scripts/start-node.sh
# Windows: full\\sidecar\\scripts\\start-node.bat
curl http://127.0.0.1:6010/health
\`\`\`

RisuAI → Import \`veil-full-${tag}.js\` → \`sidecar_url\` 기본 \`http://127.0.0.1:6010\`

## Docker (권장)

\`\`\`bash
docker pull ${image}
cd full
docker compose up -d
curl http://127.0.0.1:6010/health
\`\`\`

데이터: \`full/sidecar/data/\` (Node) 또는 volume \`veil-data\`.

저장소 전체가 필요하면 GitHub에서 clone 하세요.
`;
  writeFileSync(path.join(stagingRoot, "INSTALL-KO.md"), text, "utf8");
}

function writeCompose(stagingRoot, image) {
  const templatePath = path.join(
    root,
    "full/docker-compose.release.yml.template"
  );
  let text = readFileSync(templatePath, "utf8");
  text = text.replace(
    /^# Published image.*\n# Usage:.*\n\n/m,
    `# VEIL sidecar — ${image}\n# Usage: cd full && docker compose up -d\n\n`
  );
  text = text.replaceAll("__VEIL_IMAGE__", image);
  const fullDir = path.join(stagingRoot, "full");
  mkdirSync(fullDir, { recursive: true });
  writeFileSync(path.join(fullDir, "docker-compose.yml"), text, "utf8");
}

export function packageSidecarZip(tag, outDir) {
  const owner = resolveOwner();
  const image = `ghcr.io/${owner}/veil-sidecar:${tag}`;
  const zipName = `veil-sidecar-${tag}.zip`;
  const zipPath = path.join(outDir, zipName);
  const stagingRoot = path.join(outDir, `.staging-${tag}`);

  rmSync(stagingRoot, { recursive: true, force: true });
  mkdirSync(stagingRoot, { recursive: true });

  const sidecarSrc = path.join(root, "full/sidecar");
  const sidecarDest = path.join(stagingRoot, "full/sidecar");
  cpSync(sidecarSrc, sidecarDest, {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      if (src.includes(`${path.sep}node_modules${path.sep}`)) return false;
      if (
        src.includes(`${path.sep}data${path.sep}`) &&
        base.endsWith(".json")
      ) {
        return false;
      }
      return shouldCopySidecarEntry(base);
    },
  });

  for (const rel of SHARED_RUNTIME) {
    const src = path.join(root, rel);
    const dest = path.join(stagingRoot, rel);
    if (!existsSync(src)) throw new Error(`Missing: ${src}`);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }

  writeCompose(stagingRoot, image);
  writeInstallKo(stagingRoot, tag, image);

  mkdirSync(outDir, { recursive: true });
  rmSync(zipPath, { force: true });

  const zip = spawnSync("zip", ["-r", zipPath, "."], {
    cwd: stagingRoot,
    stdio: "inherit",
  });
  if (zip.status !== 0) {
    throw new Error("zip command failed");
  }

  rmSync(stagingRoot, { recursive: true, force: true });
  console.log(`Wrote ${zipPath}`);
  return zipPath;
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const tag = resolveTag();
  const outDir = process.argv[3] || path.join(root, "dist/release");
  packageSidecarZip(tag, outDir);
}
