import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canAdvanceTo, isValidStage } from "../../../shared/revealStages.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.VEIL_DATA_DIR || path.join(__dirname, "..", "data");
const SECRETS_FILE = path.join(DATA_DIR, "secrets.json");

let defaultSecretsLoader = null;

export function setDefaultSecretsLoader(loader) {
  defaultSecretsLoader = loader;
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readSecretsFromDisk() {
  try {
    const raw = await fs.readFile(SECRETS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.secrets)) return parsed.secrets;
    if (Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function writeSecretsToDisk(secrets) {
  await ensureDataDir();
  await fs.writeFile(
    SECRETS_FILE,
    JSON.stringify({ secrets, updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

export async function loadSecrets() {
  const existing = await readSecretsFromDisk();
  if (existing && existing.length > 0) return existing;
  if (defaultSecretsLoader) {
    const defaults = defaultSecretsLoader();
    await writeSecretsToDisk(defaults);
    return defaults;
  }
  return [];
}

export function validateSecretsArray(secrets) {
  return (
    Array.isArray(secrets) &&
    secrets.every(
      (s) => s && typeof s.id === "string" && typeof s.revealStage === "string"
    )
  );
}

export function maskSecretForResponse(secret) {
  const copy = JSON.parse(JSON.stringify(secret));
  if (copy.revealStage !== "revealed" && copy.fullSecret) {
    copy.fullSecret = null;
  }
  if (copy.revealStage === "sealed") {
    copy.title = "[sealed]";
  }
  return copy;
}

export function maskSecretsForResponse(secrets) {
  return secrets.map(maskSecretForResponse);
}

export async function replaceSecrets(secrets) {
  if (!validateSecretsArray(secrets)) {
    throw new Error("invalid_secrets");
  }
  await writeSecretsToDisk(secrets);
  return secrets;
}

export async function patchSecretStage(secretId, payload) {
  const secrets = await loadSecrets();
  const secret = secrets.find((s) => s.id === secretId);
  if (!secret) throw new Error("not_found");
  if (!payload.manual) throw new Error("manual_required");
  if (!isValidStage(payload.new_stage)) throw new Error("invalid_stage");
  if (!canAdvanceTo(secret.revealStage, payload.new_stage)) {
    throw new Error("cannot_advance");
  }
  secret.revealStage = payload.new_stage;
  secret.updatedAt = new Date().toISOString();
  await writeSecretsToDisk(secrets);
  return secret;
}
