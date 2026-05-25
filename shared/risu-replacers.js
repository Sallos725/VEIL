import {
  matchesSecret,
  getAllowedDisclosures,
  checkDisclosure,
  redactToAllowedStage,
} from "./core.js";
import {
  resolveChatBindingSafe,
  filterSecretsForBinding,
  enrichContextWithBinding,
} from "./chat-binding.js";
import { getStageIndex, VEIL_STAGE_ORDER } from "./revealStages.js";
import { normalizeRpSettings } from "./storage/rp-settings-store.js";

const MAX_INJECT_SECRETS = 8;
const MAX_DISCLOSURE_CHARS = 200;
const VEIL_SYSTEM_PREFIX = "[VEIL]";

/**
 * @param {Array<{ role?: string; content?: string }>} messages
 */
export function extractLastUserMessage(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    const role = String(msg?.role || "").toLowerCase();
    if (role === "user" || role === "human") {
      const content = msg?.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content
          .map((part) =>
            typeof part === "string" ? part : part?.text || part?.content || ""
          )
          .join("\n");
      }
      return String(content || "");
    }
  }
  return "";
}

/**
 * @param {import('./chat-binding.js').VeilSecret[]} scoped
 * @param {string} userInput
 */
export function matchSecretsForUserInput(scoped, userInput) {
  if (!userInput?.trim()) return [];
  return scoped.filter((secret) => matchesSecret(userInput, secret));
}

/**
 * @param {import('./chat-binding.js').VeilSecret[]} matched
 * @param {Record<string, unknown>} context
 */
export function buildVeilGuidanceBlock(matched, context = {}) {
  if (!matched.length) return "";

  const lines = [
    `${VEIL_SYSTEM_PREFIX} Staged secret disclosure rules for this turn.`,
    "Use ONLY allowed_disclosures for each secret. Do NOT state fullSecret or hard-blocked phrases early.",
    "",
  ];

  const slice = matched.slice(0, MAX_INJECT_SECRETS);
  for (const secret of slice) {
    const title =
      secret.revealStage === "sealed" ? "[sealed]" : secret.title || secret.id;
    const disclosures = getAllowedDisclosures(secret, context);
    lines.push(`- ${title} [${secret.revealStage}]`);
    if (disclosures.length) {
      for (const d of disclosures) {
        const text = String(d).slice(0, MAX_DISCLOSURE_CHARS);
        lines.push(`  allowed: ${text}`);
      }
    } else {
      lines.push("  allowed: (none — do not reference this secret directly)");
    }
    const blocks = (secret.hardBlocks || []).slice(0, 6);
    if (blocks.length) {
      lines.push(`  hardBlocks: ${blocks.join("; ")}`);
    }
    lines.push(
      "  rewrite: Use only stage-appropriate cues; no premature full reveal."
    );
    lines.push("");
  }

  if (matched.length > MAX_INJECT_SECRETS) {
    lines.push(`(${matched.length - MAX_INJECT_SECRETS} more secrets omitted)`);
  }

  return lines.join("\n").trim();
}

/**
 * @param {Array<{ secret_id?: string; current_stage?: string }>} violations
 * @param {import('./chat-binding.js').VeilSecret[]} scoped
 */
export function pickTargetStageFromViolations(violations, scoped) {
  let minIdx = VEIL_STAGE_ORDER.length;
  for (const v of violations) {
    const secret = scoped.find((s) => s.id === v.secret_id);
    const stage = secret?.revealStage || v.current_stage;
    const idx = getStageIndex(stage);
    if (idx >= 0 && idx < minIdx) minIdx = idx;
  }
  if (minIdx >= VEIL_STAGE_ORDER.length) return "hint";
  return VEIL_STAGE_ORDER[minIdx];
}

/**
 * @param {Array<{ role?: string; content?: string }>} messages
 * @param {string} block
 */
export function prependVeilSystemMessage(messages, block) {
  if (!block) return messages;
  const copy = Array.isArray(messages) ? [...messages] : [];
  const first = copy[0];
  if (
    first &&
    String(first.role).toLowerCase() === "system" &&
    String(first.content || "").startsWith(VEIL_SYSTEM_PREFIX)
  ) {
    copy[0] = { ...first, content: block };
    return copy;
  }
  return [{ role: "system", content: block }, ...copy];
}

/**
 * @param {object} ctx
 * @param {import('./chat-binding.js').VeilSecret[]} ctx.secrets
 * @param {object} [ctx.store]
 * @param {{ load?: () => Promise<{ secrets?: import('./chat-binding.js').VeilSecret[] }> }} [ctx.store]
 * @param {{ load?: () => Promise<object>; get?: () => object }} [ctx.rpSettingsStore]
 */
async function loadSecretsSnapshot(ctx) {
  const { secrets, store } = ctx;
  if (store?.load) {
    try {
      const loaded = await store.load();
      if (Array.isArray(loaded?.secrets)) return loaded.secrets;
    } catch {
      /* use in-memory */
    }
  }
  return secrets;
}

async function loadRpSettings(ctx) {
  if (ctx.rpSettingsStore?.load) {
    return normalizeRpSettings(await ctx.rpSettingsStore.load());
  }
  if (ctx.rpSettingsStore?.get) {
    return normalizeRpSettings(ctx.rpSettingsStore.get());
  }
  return normalizeRpSettings({});
}

function buildRpContext(binding) {
  return enrichContextWithBinding(
    {
      mode: "ic",
      speaker_id: binding?.characterId || undefined,
      listener_ids: [],
    },
    binding
  );
}

/**
 * @param {import('./risu-types.js').RisuaiPluginApi} Risuai
 * @param {object} ctx
 */
export async function registerVeilReplacers(Risuai, ctx) {
  if (!Risuai?.addRisuReplacer) {
    return { ok: false, reason: "no_replacer_api" };
  }

  let granted = true;
  if (typeof Risuai.requestPluginPermission === "function") {
    granted = await Risuai.requestPluginPermission("replacer");
  }
  if (!granted) {
    console.log("[VEIL] replacer permission denied — RP auto-link disabled.");
    return { ok: false, reason: "permission_denied" };
  }

  const beforeHandler = async (messages, _type) => {
    const settings = await loadRpSettings(ctx);
    if (!settings.enabled || !settings.injectGuidance) return messages;

    const bindResult = await resolveChatBindingSafe(Risuai);
    if (!bindResult.ok || !bindResult.binding) return messages;

    const allSecrets = await loadSecretsSnapshot(ctx);
    const scoped = filterSecretsForBinding(allSecrets, bindResult.binding);
    const userInput = extractLastUserMessage(messages);
    const matched = matchSecretsForUserInput(scoped, userInput);
    if (!matched.length) return messages;

    const block = buildVeilGuidanceBlock(
      matched,
      buildRpContext(bindResult.binding)
    );
    return prependVeilSystemMessage(messages, block);
  };

  const afterHandler = async (content, _type) => {
    const settings = await loadRpSettings(ctx);
    if (!settings.enabled || !settings.enforceRedact) {
      return content;
    }

    const text = typeof content === "string" ? content : String(content ?? "");
    if (!text.trim()) return content;

    const bindResult = await resolveChatBindingSafe(Risuai);
    if (!bindResult.ok || !bindResult.binding) return content;

    const allSecrets = await loadSecretsSnapshot(ctx);
    const scoped = filterSecretsForBinding(allSecrets, bindResult.binding);
    if (!scoped.length) return content;

    const context = buildRpContext(bindResult.binding);
    const check = checkDisclosure(text, context, scoped);
    if (check.safe) return content;

    const targetStage = pickTargetStageFromViolations(check.violations, scoped);
    const redacted = redactToAllowedStage(text, targetStage, scoped);
    let out = redacted.redacted_text || text;

    if (settings.showVeilNote && check.violations?.length) {
      out += `\n\n[VEIL: ${check.violations.length}건 완화됨]`;
    }

    return out;
  };

  await Risuai.addRisuReplacer("beforeRequest", beforeHandler);
  await Risuai.addRisuReplacer("afterRequest", afterHandler);

  const cleanup = () => {
    try {
      Risuai.removeRisuReplacer?.("beforeRequest", beforeHandler);
      Risuai.removeRisuReplacer?.("afterRequest", afterHandler);
    } catch {
      /* ignore */
    }
  };

  if (Risuai.registerPluginUnload) {
    Risuai.registerPluginUnload(cleanup);
  }

  console.log("[VEIL] RP replacers registered (beforeRequest + afterRequest).");
  return { ok: true, cleanup };
}
