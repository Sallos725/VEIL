import {
  makeGuidance,
  checkDisclosure,
  redactToAllowedStage,
  advanceRevealStage,
  listActiveSecrets,
} from "./core.js";
import {
  checkSidecarHealth,
  requestSemanticCheck,
  requestRewrite,
} from "./sidecar-client.js";
import {
  getBrowserLlmConfig,
  isBrowserLlmConfigured,
  pluginSemanticAssist,
  pluginRewriteAssist,
} from "./llm/browser-client.js";
import {
  resolveScopedSecrets,
  secretMatchesBinding,
  BINDING_GUIDE,
} from "./chat-binding.js";

export { resolveScopedSecrets as resolveScope } from "./chat-binding.js";

function mergeDisclosureResults(liteResult, assistData, assistedFlag) {
  if (!assistData || !assistData.violations) return liteResult;
  const merged = [...liteResult.violations, ...assistData.violations];
  const seen = new Set();
  const violations = merged.filter((v) => {
    const key = `${v.secret_id}:${v.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    safe: violations.length === 0,
    risk_level: violations.length === 0 ? "none" : liteResult.risk_level,
    violations,
    [assistedFlag]: true,
  };
}

async function tryPluginSemantic(Risuai, draft, liteResult, llmRaw) {
  if (!llmRaw || !Risuai) return null;
  const config = getBrowserLlmConfig(llmRaw);
  if (!isBrowserLlmConfigured(config, Risuai)) return null;
  const assist = await pluginSemanticAssist(Risuai, draft, liteResult, config);
  if (assist.ok && assist.data) {
    return { data: assist.data, via: assist.via || "plugin" };
  }
  return null;
}

export function bindingMeta(binding, bindKey, bindResult) {
  if (!bindKey) {
    return {
      binding_required: true,
      binding_ok: false,
      user_message: bindResult?.userMessage || BINDING_GUIDE,
      reason: bindResult?.reason,
      note: bindResult?.userMessage || BINDING_GUIDE,
    };
  }
  return {
    binding_ok: true,
    bind_key: bindKey,
    character: binding?.characterName,
    chat: binding?.chatLabel,
  };
}

/**
 * @param {import('./risu-types.js').RisuaiPluginApi} Risuai
 * @param {object[]} secrets
 * @param {Record<string, unknown>} [ctx]
 */
export async function getRevealGuidance(Risuai, secrets, ctx = {}) {
  const { scoped, context, bindKey, binding, bindResult } =
    await resolveScopedSecrets(Risuai, secrets, ctx);
  return {
    ...makeGuidance(ctx.user_input || "", context, scoped),
    ...bindingMeta(binding, bindKey, bindResult),
  };
}

/**
 * Lite: heuristic only. Optional sidecar when resolveSidecarUrl provided.
 */
export async function checkDisclosureLite(
  Risuai,
  secrets,
  ctx,
  resolveSidecarUrl,
  llmRaw
) {
  const { scoped, context, bindKey, binding, bindResult } =
    await resolveScopedSecrets(Risuai, secrets, ctx);
  const meta = bindingMeta(binding, bindKey, bindResult);
  const liteResult = checkDisclosure(ctx.draft_text || "", context, scoped);
  const draft = ctx.draft_text || "";

  const pluginAssist = await tryPluginSemantic(Risuai, draft, liteResult, llmRaw);
  if (pluginAssist) {
    const flag =
      pluginAssist.via === "risu" ? "risu_assisted" : "plugin_llm_assisted";
    return {
      ...mergeDisclosureResults(liteResult, pluginAssist.data, flag),
      ...meta,
    };
  }

  if (resolveSidecarUrl) {
    const sidecarUrl = await resolveSidecarUrl(context);
    if (sidecarUrl) {
      const sidecar = await requestSemanticCheck(
        {
          draft_text: draft,
          context,
          lite_result: liteResult,
        },
        sidecarUrl
      );
      if (sidecar.ok && sidecar.data) {
        return {
          ...mergeDisclosureResults(liteResult, sidecar.data, "sidecar_assisted"),
          ...meta,
        };
      }
    }
  }
  return { ...liteResult, sidecar_assisted: false, plugin_llm_assisted: false, risu_assisted: false, ...meta };
}

/**
 * Full: sidecar semantic assist expected.
 */
export async function checkDisclosureFull(
  Risuai,
  secrets,
  ctx,
  sidecarUrl,
  llmRaw
) {
  const { scoped, context, bindKey, binding, bindResult } =
    await resolveScopedSecrets(Risuai, secrets, ctx);
  const meta = bindingMeta(binding, bindKey, bindResult);
  const liteResult = checkDisclosure(ctx.draft_text || "", context, scoped);
  const draft = ctx.draft_text || "";

  const pluginAssist = await tryPluginSemantic(Risuai, draft, liteResult, llmRaw);
  if (pluginAssist) {
    const flag =
      pluginAssist.via === "risu" ? "risu_assisted" : "plugin_llm_assisted";
    return {
      ...mergeDisclosureResults(liteResult, pluginAssist.data, flag),
      ...meta,
    };
  }

  if (sidecarUrl) {
    const sidecar = await requestSemanticCheck(
      {
        draft_text: draft,
        context,
        lite_result: liteResult,
      },
      sidecarUrl
    );
    if (sidecar.ok && sidecar.data) {
      return {
        ...mergeDisclosureResults(liteResult, sidecar.data, "sidecar_assisted"),
        ...meta,
      };
    }
  }
  return { ...liteResult, sidecar_assisted: false, plugin_llm_assisted: false, risu_assisted: false, ...meta };
}

/**
 * @param {string} sidecarUrl
 */
export async function redactDraft(
  Risuai,
  secrets,
  ctx,
  sidecarUrl,
  { useSidecar = true, llmRaw } = {}
) {
  const { scoped, context, bindKey, binding, bindResult } =
    await resolveScopedSecrets(Risuai, secrets, ctx);
  const meta = bindingMeta(binding, bindKey, bindResult);
  const draft = ctx.draft_text || "";
  const targetStage = ctx.target_stage || "hint";
  const liteRedaction = redactToAllowedStage(draft, targetStage, scoped);

  const llmConfig = llmRaw ? getBrowserLlmConfig(llmRaw) : null;
  if (llmConfig && isBrowserLlmConfigured(llmConfig, Risuai)) {
    const pluginRewrite = await pluginRewriteAssist(
      Risuai,
      draft,
      targetStage,
      liteRedaction,
      llmConfig
    );
    if (pluginRewrite.ok && pluginRewrite.data) {
      const flag =
        pluginRewrite.via === "risu" ? "risu_assisted" : "plugin_llm_assisted";
      return {
        ...liteRedaction,
        redacted_text: pluginRewrite.data.redacted_text,
        explanation:
          pluginRewrite.data.explanation || liteRedaction.explanation,
        remaining_risk:
          pluginRewrite.data.remaining_risk || liteRedaction.remaining_risk,
        sidecar_assisted: false,
        plugin_llm_assisted: flag === "plugin_llm_assisted",
        risu_assisted: flag === "risu_assisted",
        ...meta,
      };
    }
  }

  if (!useSidecar || !sidecarUrl) {
    return {
      ...liteRedaction,
      sidecar_assisted: false,
      plugin_llm_assisted: false,
      risu_assisted: false,
      ...meta,
    };
  }

  const sidecar = await requestRewrite(
    {
      draft_text: draft,
      target_stage: targetStage,
      lite_result: liteRedaction,
    },
    sidecarUrl
  );
  if (sidecar.ok && sidecar.data?.redacted_text) {
    return {
      ...liteRedaction,
      redacted_text: sidecar.data.redacted_text,
      explanation: sidecar.data.explanation || liteRedaction.explanation,
      remaining_risk:
        sidecar.data.remaining_risk || liteRedaction.remaining_risk,
      sidecar_assisted: true,
      plugin_llm_assisted: false,
      risu_assisted: false,
      ...meta,
    };
  }
  return {
    ...liteRedaction,
    sidecar_assisted: false,
    plugin_llm_assisted: false,
    risu_assisted: false,
    ...meta,
  };
}

export async function advanceStage(Risuai, secrets, store, ctx) {
  const { bindKey, binding, bindResult } = await resolveScopedSecrets(
    Risuai,
    secrets,
    ctx
  );
  const meta = bindingMeta(binding, bindKey, bindResult);

  if (
    binding &&
    !secretMatchesBinding(
      secrets.find((s) => s.id === ctx.secret_id) || {},
      binding
    )
  ) {
    return { ok: false, error: "현재 채팅에 바인딩된 시크릿이 아닙니다.", ...meta };
  }

  const result = advanceRevealStage(secrets, ctx.secret_id, ctx.new_stage, {
    manual: ctx.manual,
    reason: ctx.reason,
  });
  if (result.ok && store) await store.save(secrets);
  return { ...result, ...meta };
}

export async function listSecretsMeta(Risuai, secrets, ctx = {}) {
  const { scoped, context, bindKey, binding, bindResult } =
    await resolveScopedSecrets(Risuai, secrets, ctx);
  return {
    ...listActiveSecrets(scoped, context),
    ...bindingMeta(binding, bindKey, bindResult),
  };
}

export async function getSidecarStatus(sidecarUrl, edition = "full") {
  if (!sidecarUrl) {
    return {
      enabled: false,
      reachable: false,
      features: edition === "lite" ? ["plugin_llm", "heuristic_scan"] : [],
      edition,
      note:
        edition === "lite"
          ? "sidecar_url 미설정. GUI LLM 또는 휴리스틱 스캔 사용."
          : "sidecar가 필요합니다. Docker로 sidecar를 실행하세요.",
    };
  }
  const health = await checkSidecarHealth(sidecarUrl);
  return {
    ...health,
    edition,
    note: health.reachable
      ? "Sidecar 연결됨."
      : edition === "full"
        ? "Sidecar에 연결할 수 없습니다. VEIL Full 기능이 제한됩니다."
        : "Sidecar 미연결.",
  };
}

export { createSidecarResolver as createDefaultSidecarResolver } from "./plugin-options.js";
