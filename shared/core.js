import { normalizeText } from "./text.js";
import {
  VEIL_STAGE_ORDER,
  canAdvanceTo,
  isValidStage,
} from "./revealStages.js";
import {
  mayIncludeFullSecretInGuidance,
  checkKnowledgeBoundaryViolations,
  speakerKnowsSecret,
} from "./knowledgeBoundary.js";

export { normalizeText } from "./text.js";
export { VEIL_STAGE_ORDER, canAdvanceTo, isValidStage } from "./revealStages.js";

export function getAllowedDisclosures(secret, context = {}) {
  const ladder = secret.revealLadder || {};
  let disclosures = [];

  switch (secret.revealStage) {
    case "sealed":
      disclosures = [];
      break;
    case "foreshadow":
      disclosures = [...(ladder.foreshadow || [])];
      break;
    case "hint":
      disclosures = [
        ...(ladder.foreshadow || []),
        ...(ladder.hint || []),
      ];
      break;
    case "partial":
      disclosures = [
        ...(ladder.foreshadow || []),
        ...(ladder.hint || []),
        ...(ladder.partial || []),
      ];
      break;
    case "near_reveal":
      disclosures = [
        ...(ladder.foreshadow || []),
        ...(ladder.hint || []),
        ...(ladder.partial || []),
        ...(ladder.nearReveal || []),
      ];
      break;
    case "revealed":
      disclosures = [
        ...(ladder.foreshadow || []),
        ...(ladder.hint || []),
        ...(ladder.partial || []),
        ...(ladder.nearReveal || []),
      ];
      if (mayIncludeFullSecretInGuidance(secret, context)) {
        disclosures.push(ladder.revealed || secret.fullSecret);
      }
      break;
    default:
      disclosures = [];
  }

  return disclosures.filter(Boolean);
}

export function matchesSecret(userInput, secret) {
  const haystack = normalizeText(userInput);
  if (!haystack) return false;

  if (
    normalizeText(secret.title) &&
    haystack.includes(normalizeText(secret.title))
  ) {
    return true;
  }

  return (secret.tags || []).some((tag) =>
    haystack.includes(normalizeText(tag))
  );
}

export function makeGuidance(userInput, context, secrets) {
  const matched = secrets.filter((secret) => matchesSecret(userInput, secret));

  return {
    matched_secrets: matched.map((secret) => ({
      secret_id: secret.id,
      title: secret.revealStage === "sealed" ? "[sealed]" : secret.title,
      allowed_stage: secret.revealStage,
      allowed_disclosures: getAllowedDisclosures(secret, context),
      blocked_reveals: secret.hardBlocks || [],
      rewrite_guidance:
        secret.revealStage === "sealed"
          ? "Do not acknowledge the secret directly. Use neutral behavior or omit the topic."
          : "Use only the allowed disclosures for the current reveal stage. Do not reveal the full secret early.",
    })),
    global_guidance:
      matched.length === 0
        ? "No matching VEIL secret found. Continue normally, but avoid inventing hidden lore."
        : "Use VEIL guidance to preserve mystery while allowing stage-appropriate clues.",
  };
}

export function checkDisclosure(draftText, context, secrets) {
  const text = normalizeText(draftText);
  const violations = [];
  const speakerId = context && context.speaker_id;

  for (const secret of secrets) {
    const fullSecret = normalizeText(secret.fullSecret);

    violations.push(
      ...checkKnowledgeBoundaryViolations(secret, context, draftText)
    );

    if (
      speakerId &&
      !speakerKnowsSecret(secret, speakerId) &&
      fullSecret &&
      text.includes(fullSecret)
    ) {
      violations.push({
        secret_id: secret.id,
        reason:
          "Speaker appears to reveal a secret they are marked as not knowing.",
        current_stage: secret.revealStage,
        detected_leak: secret.fullSecret,
        suggested_rewrite:
          "Rewrite so the speaker reacts with uncertainty, suspicion, or indirect emotion instead of stating the hidden fact.",
      });
    }

    if (
      secret.revealStage !== "revealed" &&
      fullSecret &&
      text.includes(fullSecret)
    ) {
      violations.push({
        secret_id: secret.id,
        reason: "Draft reveals fullSecret before revealStage is revealed.",
        current_stage: secret.revealStage,
        detected_leak: secret.fullSecret,
        suggested_rewrite:
          "Use only stage-appropriate foreshadowing, hints, or partial truth.",
      });
    }

    for (const blocked of secret.hardBlocks || []) {
      const normalizedBlocked = normalizeText(blocked);
      if (
        secret.revealStage !== "revealed" &&
        normalizedBlocked &&
        text.includes(normalizedBlocked)
      ) {
        violations.push({
          secret_id: secret.id,
          reason: "Draft contains a hard-blocked phrase before full reveal.",
          current_stage: secret.revealStage,
          detected_leak: blocked,
          suggested_rewrite:
            "Remove or soften the blocked phrase according to the current reveal stage.",
        });
      }
    }
  }

  const unique = dedupeViolations(violations);

  return {
    safe: unique.length === 0,
    risk_level: computeRiskLevel(unique),
    violations: unique,
  };
}

function dedupeViolations(violations) {
  const seen = new Set();
  return violations.filter((v) => {
    const key = `${v.secret_id}:${v.reason}:${v.detected_leak}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function computeRiskLevel(violations) {
  if (violations.length === 0) return "none";
  if (violations.length >= 2) return "critical";
  if (
    violations.some((v) =>
      String(v.reason).includes("fullSecret") ||
      String(v.reason).includes("hard-blocked")
    )
  ) {
    return "high";
  }
  return "medium";
}

export function collectPhrasesAboveStage(secret, targetStage) {
  const ladder = secret.revealLadder || {};
  const targetIndex = VEIL_STAGE_ORDER.indexOf(targetStage);
  const phrases = [];

  const stageMap = [
    ["foreshadow", ladder.foreshadow],
    ["hint", ladder.hint],
    ["partial", ladder.partial],
    ["near_reveal", ladder.nearReveal],
    ["revealed", ladder.revealed ? [ladder.revealed] : []],
  ];

  for (const [stage, items] of stageMap) {
    const idx = VEIL_STAGE_ORDER.indexOf(stage);
    if (idx > targetIndex) {
      if (Array.isArray(items)) phrases.push(...items);
      else if (typeof items === "string") phrases.push(items);
    }
  }

  if (targetStage !== "revealed" && secret.fullSecret) {
    phrases.push(secret.fullSecret);
  }

  return [...new Set(phrases.filter(Boolean))];
}

export function redactToAllowedStage(draftText, targetStage, secrets = []) {
  let redacted = String(draftText || "");
  let changed = false;

  for (const secret of secrets) {
    for (const blocked of secret.hardBlocks || []) {
      if (!blocked) continue;
      const pattern = new RegExp(escapeRegExp(blocked), "gi");
      if (pattern.test(redacted)) {
        redacted = redacted.replace(pattern, "[…]");
        changed = true;
      }
    }

    for (const phrase of collectPhrasesAboveStage(secret, targetStage)) {
      const pattern = new RegExp(escapeRegExp(phrase), "gi");
      if (pattern.test(redacted)) {
        redacted = redacted.replace(pattern, "[…]");
        changed = true;
      }
    }
  }

  return {
    redacted_text: redacted,
    explanation: changed
      ? `Redacted phrases above the target stage (${targetStage}). Revise for mood, hesitation, or indirect clues as needed.`
      : `No automatic redaction applied. Rewrite manually for target stage: ${targetStage}.`,
    remaining_risk: changed ? "low" : "medium",
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function advanceRevealStage(secrets, secretId, newStage, options = {}) {
  if (!options.manual) {
    return {
      ok: false,
      error: "Stage advancement requires manual: true.",
    };
  }

  if (!isValidStage(newStage)) {
    return { ok: false, error: `Invalid reveal stage: ${newStage}` };
  }

  const secret = secrets.find((s) => s.id === secretId);
  if (!secret) {
    return { ok: false, error: `Secret not found: ${secretId}` };
  }

  if (!canAdvanceTo(secret.revealStage, newStage)) {
    return {
      ok: false,
      error: `Cannot advance from ${secret.revealStage} to ${newStage}. Stages only move forward.`,
    };
  }

  secret.revealStage = newStage;
  secret.updatedAt = new Date().toISOString();

  return {
    ok: true,
    secret_id: secret.id,
    new_stage: newStage,
    reason: options.reason || "manual advancement",
  };
}

export function listActiveSecrets(secrets, context = {}) {
  const debug = (context && context.mode) === "debug";

  return {
    secrets: secrets.map((secret) => ({
      secret_id: secret.id,
      title:
        secret.revealStage === "sealed" && !debug
          ? "[sealed]"
          : secret.title,
      scopeType: secret.scopeType,
      scopeId: secret.scopeId,
      revealStage: secret.revealStage,
      tags: secret.tags || [],
      visibilityMode: secret.visibilityMode,
      updatedAt: secret.updatedAt,
    })),
  };
}
