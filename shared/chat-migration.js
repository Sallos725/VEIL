import {
  listCharacterChatSessions,
  attachChatBinding,
  secretMatchesBinding,
  makeBindKey,
} from "./chat-binding.js";

/**
 * Secrets still on index bind keys while Risu chat.id exists for that slot.
 * @param {object[]} secrets
 * @param {object} character
 * @param {number} charIndex
 */
export function countMigratableToCid(secrets, character, charIndex) {
  const sessions = listCharacterChatSessions(character, charIndex);
  let count = 0;
  for (const session of sessions) {
    if (!session.chatSessionId) continue;
    for (const secret of secrets) {
      if (isLegacyIndexSecret(secret, session)) count += 1;
    }
  }
  return count;
}

function isLegacyIndexSecret(secret, session) {
  if (!session.chatSessionId) return false;
  const legacy = session.bindKeyLegacy;
  if (secret.bindKey === session.bindKey) return false;
  if (secret.bindKey === legacy || secret.scopeId === legacy) return true;
  if (secret.bindKeyLegacy === legacy && !secret.chatSessionId) return true;
  return secretMatchesBinding(secret, {
    bindKey: legacy,
    matchKeys: [legacy],
    characterId: session.characterId,
    charIndex: session.chatIndex,
    chatIndex: session.chatIndex,
    characterName: "",
    chatLabel: session.label,
    label: session.label,
  });
}

/**
 * Rebind index-key secrets to cid:chaId:chat.id for this character's chats.
 * @param {object[]} secrets — mutated in place
 * @param {object} character
 * @param {number} charIndex
 */
export function migrateIndexSecretsToCid(secrets, character, charIndex) {
  const sessions = listCharacterChatSessions(character, charIndex);
  const characterName =
    character.name || character.displayName || `캐릭터 #${charIndex}`;
  let migrated = 0;

  for (const session of sessions) {
    if (!session.chatSessionId) continue;

    for (const secret of secrets) {
      if (!isLegacyIndexSecret(secret, session)) continue;

      const binding = {
        bindKey: session.bindKey,
        bindKeyLegacy: session.bindKeyLegacy,
        matchKeys: [session.bindKey, session.bindKeyLegacy],
        chatSessionId: session.chatSessionId,
        charIndex,
        chatIndex: session.chatIndex,
        characterId: session.characterId,
        characterName,
        chatLabel: session.label,
        label: `${characterName} · ${session.label}`,
      };
      Object.assign(secret, attachChatBinding(secret, binding));
      secret.updatedAt = new Date().toISOString();
      migrated += 1;
    }
  }

  return {
    migrated,
    sessionsWithId: sessions.filter((s) => s.chatSessionId).length,
    sessionsIndexOnly: sessions.filter((s) => !s.chatSessionId).length,
  };
}

/**
 * @param {object[]} secrets
 * @param {number} charIndex
 * @param {number} chatIndex
 */
export function findSecretsOnIndexKey(secrets, charIndex, chatIndex) {
  const legacy = makeBindKey(charIndex, chatIndex);
  return secrets.filter(
    (s) =>
      s.bindKey === legacy ||
      s.scopeId === legacy ||
      s.bindKeyLegacy === legacy
  );
}
