import { normalizeText } from "./text.js";

export function speakerKnowsSecret(secret, speakerId) {
  if (!speakerId) return true;
  if (Array.isArray(secret.unknownBy) && secret.unknownBy.includes(speakerId)) {
    return false;
  }
  if (Array.isArray(secret.knownBy) && secret.knownBy.length > 0) {
    return secret.knownBy.includes(speakerId);
  }
  return true;
}

export function speakerMayDisclose(secret, context) {
  const speakerId = context && context.speaker_id;
  if (!speakerId) return true;

  if (
    Array.isArray(secret.blockedSpeakers) &&
    secret.blockedSpeakers.includes(speakerId)
  ) {
    return false;
  }

  if (
    Array.isArray(secret.allowedSpeakers) &&
    secret.allowedSpeakers.length > 0 &&
    !secret.allowedSpeakers.includes(speakerId)
  ) {
    return false;
  }

  return speakerKnowsSecret(secret, speakerId);
}

export function listenerMayHear(secret, listenerId) {
  if (!listenerId) return true;

  if (
    Array.isArray(secret.blockedListeners) &&
    secret.blockedListeners.includes(listenerId)
  ) {
    return false;
  }

  if (
    Array.isArray(secret.allowedListeners) &&
    secret.allowedListeners.length > 0 &&
    !secret.allowedListeners.includes(listenerId)
  ) {
    return false;
  }

  return true;
}

export function listenersMayHear(secret, context) {
  const listenerIds =
    (context && context.listener_ids) || (context && context.listenerIds) || [];
  if (!Array.isArray(listenerIds) || listenerIds.length === 0) return true;
  return listenerIds.every((id) => listenerMayHear(secret, id));
}

export function isPersonaSecretBlockedInIc(secret, context) {
  const mode = (context && context.mode) || "ic";
  if (mode !== "ic") return false;
  if (secret.scopeType !== "persona") return false;

  const personaId = context && context.persona_id;
  const speakerId = context && context.speaker_id;
  if (!personaId || !speakerId) return false;

  return speakerId !== personaId && speakerId !== "narrator";
}

export function mayIncludeFullSecretInGuidance(secret, context) {
  if (secret.revealStage !== "revealed") return false;
  if (!speakerMayDisclose(secret, context)) return false;
  if (!listenersMayHear(secret, context)) return false;
  if (isPersonaSecretBlockedInIc(secret, context)) return false;
  return true;
}

export function checkKnowledgeBoundaryViolations(secret, context, draftText) {
  const text = normalizeText(draftText);
  const violations = [];
  const speakerId = context && context.speaker_id;
  const fullSecret = normalizeText(secret.fullSecret);
  const mode = (context && context.mode) || "ic";

  if (!fullSecret || !text.includes(fullSecret)) {
    return violations;
  }

  if (speakerId && !speakerMayDisclose(secret, context)) {
    violations.push({
      secret_id: secret.id,
      reason:
        mode === "ic"
          ? "Speaker is not allowed to disclose this secret in the current mode."
          : "Speaker is blocked from disclosing this secret.",
      current_stage: secret.revealStage,
      detected_leak: secret.fullSecret,
      suggested_rewrite:
        "Rewrite from a permitted speaker, use indirect emotion, or shift to narrator/OOC if appropriate.",
    });
  }

  if (!listenersMayHear(secret, context)) {
    violations.push({
      secret_id: secret.id,
      reason: "A listener is not allowed to hear this secret yet.",
      current_stage: secret.revealStage,
      detected_leak: secret.fullSecret,
      suggested_rewrite:
        "Keep the secret indirect or remove it until the listener is permitted to hear it.",
    });
  }

  if (isPersonaSecretBlockedInIc(secret, context)) {
    violations.push({
      secret_id: secret.id,
      reason: "Persona-private fact must not appear in IC character dialogue.",
      current_stage: secret.revealStage,
      detected_leak: secret.fullSecret,
      suggested_rewrite:
        "Keep persona-private facts out of IC dialogue unless the persona is the speaker.",
    });
  }

  return violations;
}
