import {
  filterSecretsForBinding,
  attachChatBinding,
  removeSecretsForBinding,
} from "../chat-binding.js";
import { validateSecrets } from "./pluginStore.js";

export const SESSION_EXPORT_VERSION = "1";

/**
 * @param {object[]} secrets
 * @param {import('../chat-binding.js').ChatBinding} viewBinding
 */
export function exportSessionSecrets(secrets, viewBinding) {
  const scoped = filterSecretsForBinding(secrets, viewBinding);
  return {
    veilSessionExport: SESSION_EXPORT_VERSION,
    bindKey: viewBinding.bindKey,
    bindKeyLegacy: viewBinding.bindKeyLegacy,
    chatSessionId: viewBinding.chatSessionId,
    characterId: viewBinding.characterId,
    characterName: viewBinding.characterName,
    chatLabel: viewBinding.chatLabel,
    exportedAt: new Date().toISOString(),
    secrets: JSON.parse(JSON.stringify(scoped)),
  };
}

/**
 * @param {unknown} parsed
 */
export function parseSessionImportPayload(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "JSON 객체가 아닙니다." };
  }
  const record = /** @type {Record<string, unknown>} */ (parsed);
  let list = null;
  if (record.veilSessionExport && Array.isArray(record.secrets)) {
    list = record.secrets;
  } else if (Array.isArray(parsed)) {
    list = parsed;
  } else if (Array.isArray(record.secrets)) {
    list = record.secrets;
  }
  if (!validateSecrets(list)) {
    return { ok: false, error: "유효하지 않은 시크릿 배열입니다." };
  }
  return {
    ok: true,
    secrets: list,
    meta: record.veilSessionExport
      ? {
          bindKey: record.bindKey,
          exportedAt: record.exportedAt,
          chatLabel: record.chatLabel,
        }
      : null,
  };
}

/**
 * @param {object} opts
 * @param {object[]} opts.allSecrets — mutated
 * @param {object[]} opts.imported
 * @param {import('../chat-binding.js').ChatBinding} opts.viewBinding
 * @param {'replace' | 'merge'} opts.mode
 */
export function mergeSessionImport({ allSecrets, imported, viewBinding, mode }) {
  const bound = imported.map((s) => attachChatBinding(s, viewBinding));
  let removed = 0;

  if (mode === "replace") {
    const result = removeSecretsForBinding(allSecrets, viewBinding);
    removed = result.removed;
  }

  let added = 0;
  let updated = 0;

  for (const secret of bound) {
    const idx = allSecrets.findIndex((s) => s.id === secret.id);
    if (idx >= 0) {
      allSecrets[idx] = {
        ...allSecrets[idx],
        ...secret,
        updatedAt: new Date().toISOString(),
      };
      updated += 1;
    } else {
      allSecrets.push(secret);
      added += 1;
    }
  }

  return { ok: true, removed, added, updated, total: bound.length };
}
