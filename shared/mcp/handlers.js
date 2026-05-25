import {
  makeGuidance,
  checkDisclosure,
  redactToAllowedStage,
  advanceRevealStage,
  listActiveSecrets,
} from "../core.js";
import {
  checkSidecarHealth,
  requestSemanticCheck,
  requestRewrite,
} from "../sidecar-client.js";
import {
  resolveScopedSecrets,
  secretMatchesBinding,
  BINDING_GUIDE,
} from "../chat-binding.js";

export function jsonResult(value) {
  return [{ type: "text", text: JSON.stringify(value, null, 2) }];
}

function mergeDisclosureResults(liteResult, sidecarData) {
  if (!sidecarData || !sidecarData.violations) return liteResult;
  const merged = [...liteResult.violations, ...sidecarData.violations];
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
    sidecar_assisted: true,
  };
}

function bindingMeta(binding, bindKey, bindResult) {
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

export function createLiteToolHandler(
  secrets,
  store,
  resolveSidecarUrl,
  Risuai
) {
  return async function handleLiteTool(toolName, content) {
    const ctx = content || {};
    const { scoped, context, bindKey, binding, bindResult } =
      await resolveScopedSecrets(Risuai, secrets, ctx);
    const meta = bindingMeta(binding, bindKey, bindResult);

    switch (toolName) {
      case "get_reveal_guidance":
        return jsonResult({
          ...makeGuidance(ctx.user_input || "", context, scoped),
          ...meta,
        });
      case "check_disclosure": {
        const liteResult = checkDisclosure(
          ctx.draft_text || "",
          context,
          scoped
        );
        if (resolveSidecarUrl) {
          const sidecarUrl = await resolveSidecarUrl(context);
          if (!sidecarUrl) {
            return jsonResult({ ...liteResult, sidecar_assisted: false, ...meta });
          }
          const sidecar = await requestSemanticCheck(
            {
              draft_text: ctx.draft_text || "",
              context,
              lite_result: liteResult,
            },
            sidecarUrl
          );
          if (sidecar.ok && sidecar.data) {
            return jsonResult({
              ...mergeDisclosureResults(liteResult, sidecar.data),
              ...meta,
            });
          }
        }
        return jsonResult({ ...liteResult, sidecar_assisted: false, ...meta });
      }
      case "redact_to_allowed_stage":
        return jsonResult({
          ...redactToAllowedStage(
            ctx.draft_text || "",
            ctx.target_stage || "hint",
            scoped
          ),
          ...meta,
        });
      case "advance_reveal_stage": {
        if (
          binding &&
          !secretMatchesBinding(
            secrets.find((s) => s.id === ctx.secret_id) || {},
            binding
          )
        ) {
          return jsonResult({
            ok: false,
            error: "현재 채팅에 바인딩된 시크릿이 아닙니다.",
            ...meta,
          });
        }
        const result = advanceRevealStage(
          secrets,
          ctx.secret_id,
          ctx.new_stage,
          { manual: ctx.manual, reason: ctx.reason }
        );
        if (result.ok) await store.save(secrets);
        return jsonResult({ ...result, ...meta });
      }
      case "list_active_secrets":
        return jsonResult({ ...listActiveSecrets(scoped, context), ...meta });
      case "check_sidecar_status": {
        if (resolveSidecarUrl) {
          const sidecarUrl = await resolveSidecarUrl(context);
          if (!sidecarUrl) {
            return jsonResult({
              enabled: false,
              reachable: false,
              features: ["plugin_llm", "heuristic_scan"],
              edition: "lite",
              note: "sidecar_url 미설정. llm_base_url으로 Ollama 직접 연결 또는 휴리스틱 스캔 사용.",
              ...meta,
            });
          }
          const health = await checkSidecarHealth(sidecarUrl);
          return jsonResult({
            ...health,
            edition: "lite",
            note: health.reachable
              ? "Optional sidecar configured for Lite."
              : "Set sidecar_url plugin arg or run without sidecar (plugin LLM/heuristic scan).",
            ...meta,
          });
        }
        return jsonResult({
          enabled: false,
          reachable: false,
          features: [],
          edition: "lite",
          note: "No sidecar_url configured. Lorebook scan uses plugin LLM or heuristic.",
          ...meta,
        });
      }
      default:
        return [{ type: "text", text: "Unknown VEIL Lite tool: " + toolName }];
    }
  };
}

export function createFullToolHandler(
  secrets,
  store,
  resolveSidecarUrl,
  Risuai
) {
  return async function handleFullTool(toolName, content) {
    const ctx = content || {};
    const { scoped, context, bindKey, binding, bindResult } =
      await resolveScopedSecrets(Risuai, secrets, ctx);
    const meta = bindingMeta(binding, bindKey, bindResult);
    const sidecarUrl = await resolveSidecarUrl(context);

    switch (toolName) {
      case "get_reveal_guidance":
        return jsonResult({
          ...makeGuidance(ctx.user_input || "", context, scoped),
          ...meta,
        });
      case "check_disclosure": {
        const liteResult = checkDisclosure(
          ctx.draft_text || "",
          context,
          scoped
        );
        const sidecar = await requestSemanticCheck(
          {
            draft_text: ctx.draft_text || "",
            context,
            lite_result: liteResult,
          },
          sidecarUrl
        );
        if (sidecar.ok && sidecar.data) {
          return jsonResult({
            ...mergeDisclosureResults(liteResult, sidecar.data),
            ...meta,
          });
        }
        return jsonResult({ ...liteResult, sidecar_assisted: false, ...meta });
      }
      case "redact_to_allowed_stage": {
        const liteRedaction = redactToAllowedStage(
          ctx.draft_text || "",
          ctx.target_stage || "hint",
          scoped
        );
        const sidecar = await requestRewrite(
          {
            draft_text: ctx.draft_text || "",
            target_stage: ctx.target_stage || "hint",
            lite_result: liteRedaction,
          },
          sidecarUrl
        );
        if (sidecar.ok && sidecar.data && sidecar.data.redacted_text) {
          return jsonResult({
            ...liteRedaction,
            redacted_text: sidecar.data.redacted_text,
            explanation:
              sidecar.data.explanation || liteRedaction.explanation,
            remaining_risk:
              sidecar.data.remaining_risk || liteRedaction.remaining_risk,
            sidecar_assisted: true,
            ...meta,
          });
        }
        return jsonResult({ ...liteRedaction, sidecar_assisted: false, ...meta });
      }
      case "advance_reveal_stage": {
        if (
          binding &&
          !secretMatchesBinding(
            secrets.find((s) => s.id === ctx.secret_id) || {},
            binding
          )
        ) {
          return jsonResult({
            ok: false,
            error: "현재 채팅에 바인딩된 시크릿이 아닙니다.",
            ...meta,
          });
        }
        const result = advanceRevealStage(
          secrets,
          ctx.secret_id,
          ctx.new_stage,
          { manual: ctx.manual, reason: ctx.reason }
        );
        if (result.ok) await store.save(secrets);
        return jsonResult({ ...result, ...meta });
      }
      case "list_active_secrets":
        return jsonResult({ ...listActiveSecrets(scoped, context), ...meta });
      case "check_sidecar_status":
        return jsonResult({ ...(await checkSidecarHealth(sidecarUrl)), ...meta });
      default:
        return [{ type: "text", text: "Unknown VEIL Full tool: " + toolName }];
    }
  };
}

export { createSidecarResolver as createDefaultSidecarResolver } from "../plugin-options.js";
