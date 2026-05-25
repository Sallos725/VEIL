/**
 * @typedef {object} VeilSecret
 */

/**
 * @typedef {object} ChatBinding
 * @property {string} bindKey — primary scope key (cid:… when chat.id exists)
 * @property {string} [bindKeyLegacy] — index key `${charIndex}:${chatIndex}` for older data
 * @property {string[]} matchKeys — keys accepted by secretMatchesBinding
 * @property {string} [chatSessionId] — Risu chat.id (stable across reorder)
 * @property {number} charIndex
 * @property {number} chatIndex
 * @property {string} characterId — chaId
 * @property {string} characterName
 * @property {string} chatLabel
 * @property {string} label
 */

/**
 * @typedef {object} ChatBindingResult
 * @property {boolean} ok
 * @property {ChatBinding | null} binding
 * @property {string} userMessage
 * @property {string} [reason]
 * @property {string} [detail]
 */

export const BINDING_REASON = {
  NO_API: "no_api",
  NO_SELECTION: "no_selection",
  INVALID_CHARACTER: "invalid_character",
  NO_CHAT: "no_chat",
  INVALID_CHAT: "invalid_chat",
  RISU_ERROR: "risu_error",
};

/** 사용자에게 보여 줄 기본 안내 (한국어) */
export const BINDING_GUIDE =
  "RisuAI에서 봇(캐릭터)을 선택하고, 채팅 화면을 연 상태에서 햄버거 메뉴 → VEIL을 여세요.";

const USER_MESSAGES = {
  [BINDING_REASON.NO_API]:
    "이 환경에서는 채팅 연결 API를 사용할 수 없습니다. RisuAI 플러그인으로 실행해 주세요.",
  [BINDING_REASON.NO_SELECTION]: BINDING_GUIDE,
  [BINDING_REASON.INVALID_CHARACTER]:
    "선택된 봇을 찾을 수 없습니다. 채팅 목록에서 캐릭터를 연 뒤 VEIL을 다시 여세요.",
  [BINDING_REASON.NO_CHAT]:
    "이 봇에 채팅이 없습니다. 새 채팅을 시작한 뒤 VEIL을 열어주세요.",
  [BINDING_REASON.INVALID_CHAT]:
    "활성 채팅을 확인할 수 없습니다. 채팅 탭을 선택한 뒤 VEIL을 다시 여세요.",
  [BINDING_REASON.RISU_ERROR]:
    "채팅 정보를 읽지 못했습니다. 봇과 채팅을 선택한 뒤 VEIL을 다시 여세요.",
};

function fail(reason, detail) {
  return {
    ok: false,
    binding: null,
    reason,
    userMessage: USER_MESSAGES[reason] || BINDING_GUIDE,
    detail: detail ? String(detail) : undefined,
  };
}

function ok(binding) {
  return {
    ok: true,
    binding,
    userMessage: "",
    reason: undefined,
    detail: undefined,
  };
}

/**
 * Legacy index bind key (array position — breaks if chats are reordered).
 * @param {number} charIndex
 * @param {number} chatIndex
 */
export function makeBindKey(charIndex, chatIndex) {
  return `${charIndex}:${chatIndex}`;
}

/**
 * Stable session bind key from Risu character id + chat.id.
 * @param {string} characterId — chaId
 * @param {string} chatSessionId — chat.id
 */
export function makeSessionBindKey(characterId, chatSessionId) {
  return `cid:${characterId}:${chatSessionId}`;
}

/**
 * @param {ChatBinding} binding
 */
export function getMatchKeys(binding) {
  if (!binding) return [];
  if (Array.isArray(binding.matchKeys) && binding.matchKeys.length) {
    return binding.matchKeys;
  }
  const keys = [];
  if (binding.bindKey) keys.push(binding.bindKey);
  if (binding.bindKeyLegacy && !keys.includes(binding.bindKeyLegacy)) {
    keys.push(binding.bindKeyLegacy);
  }
  return keys;
}

/**
 * @param {string} bindKey
 * @param {string} [bindKeyLegacy]
 */
function buildMatchKeys(bindKey, bindKeyLegacy) {
  const keys = [];
  if (bindKey) keys.push(bindKey);
  if (bindKeyLegacy && !keys.includes(bindKeyLegacy)) keys.push(bindKeyLegacy);
  return keys;
}

function normalizeIndex(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

function resolveChatIndex(character, preferredIndex) {
  const chats = character.chats;
  if (!Array.isArray(chats) || chats.length === 0) return null;

  let idx = normalizeIndex(preferredIndex);
  if (idx == null && typeof character.chatPage === "number") {
    idx = normalizeIndex(character.chatPage);
  }
  if (idx == null) idx = 0;

  if (chats[idx]) return idx;

  const page = normalizeIndex(character.chatPage);
  if (page != null && chats[page]) return page;

  return 0;
}

/**
 * RisuAI getCurrent* 호출은 채팅 미선택 시 내부에서 터질 수 있어 try/catch + DB 검증.
 * @param {import('./risu-types.js').RisuaiPluginApi} [Risuai]
 * @returns {Promise<ChatBindingResult>}
 */
export async function resolveChatBindingSafe(Risuai) {
  if (
    !Risuai ||
    typeof Risuai.getCurrentCharacterIndex !== "function"
  ) {
    return fail(BINDING_REASON.NO_API);
  }

  let charIndex = null;
  try {
    charIndex = normalizeIndex(await Risuai.getCurrentCharacterIndex());
  } catch (error) {
    return fail(BINDING_REASON.RISU_ERROR, error?.message || error);
  }

  if (charIndex == null) {
    return fail(BINDING_REASON.NO_SELECTION);
  }

  let db = null;
  if (typeof Risuai.getDatabase === "function") {
    try {
      db = await Risuai.getDatabase(["characters"]);
    } catch (error) {
      return fail(BINDING_REASON.RISU_ERROR, error?.message || error);
    }
  }

  const character = db?.characters?.[charIndex];
  if (!character) {
    return fail(BINDING_REASON.INVALID_CHARACTER);
  }

  if (character.type === "group") {
    return fail(
      BINDING_REASON.INVALID_CHARACTER,
      "group chat is not supported yet"
    );
  }

  let preferredChatIndex = null;
  if (typeof Risuai.getCurrentChatIndex === "function") {
    try {
      preferredChatIndex = normalizeIndex(
        await Risuai.getCurrentChatIndex()
      );
    } catch {
      preferredChatIndex = null;
    }
  }

  const chatIndex = resolveChatIndex(character, preferredChatIndex);
  if (chatIndex == null) {
    return fail(BINDING_REASON.NO_CHAT);
  }

  const chat = character.chats[chatIndex];
  if (!chat) {
    return fail(BINDING_REASON.INVALID_CHAT);
  }

  const characterName =
    character.name || character.displayName || `캐릭터 #${charIndex}`;
  const characterId = String(character.chaId ?? character.id ?? charIndex);
  const chatSessionId =
    chat.id != null && String(chat.id).length > 0
      ? String(chat.id)
      : null;
  const chatLabel =
    chat.name || chat.title || chat.chatName || `채팅 #${chatIndex + 1}`;
  const bindKeyLegacy = makeBindKey(charIndex, chatIndex);
  const bindKey = chatSessionId
    ? makeSessionBindKey(characterId, chatSessionId)
    : bindKeyLegacy;

  return ok({
    bindKey,
    bindKeyLegacy: chatSessionId ? bindKeyLegacy : undefined,
    matchKeys: buildMatchKeys(bindKey, chatSessionId ? bindKeyLegacy : undefined),
    chatSessionId: chatSessionId || undefined,
    charIndex,
    chatIndex,
    characterId,
    characterName,
    chatLabel,
    label: `${characterName} · ${chatLabel}`,
  });
}

/**
 * @param {import('./risu-types.js').RisuaiPluginApi} [Risuai]
 * @returns {Promise<ChatBinding | null>}
 */
export async function resolveChatBinding(Risuai) {
  const result = await resolveChatBindingSafe(Risuai);
  return result.binding;
}

/**
 * @param {ChatBindingResult} result
 */
export function bindingBannerText(result) {
  if (result.ok && result.binding) {
    const stable = result.binding.chatSessionId
      ? " (세션 ID 고정)"
      : " (인덱스 키 — 채팅 순서 변경 시 주의)";
    return `연결된 채팅: ${result.binding.label}${stable} — 이 세션에만 시크릿이 적용됩니다.`;
  }
  return result.userMessage || BINDING_GUIDE;
}

/**
 * @param {VeilSecret} secret
 * @param {string | ChatBinding} bindKeyOrBinding
 */
export function secretMatchesBinding(secret, bindKeyOrBinding) {
  if (!secret || !bindKeyOrBinding) return false;

  const keys =
    typeof bindKeyOrBinding === "string"
      ? [bindKeyOrBinding]
      : getMatchKeys(bindKeyOrBinding);

  if (keys.length === 0) return false;

  for (const key of keys) {
    if (secret.bindKey === key) return true;
    if (secret.scopeType === "chat" && secret.scopeId === key) return true;
    if (secret.bindKeyLegacy === key) return true;
  }

  if (typeof bindKeyOrBinding !== "string") {
    const { characterId, chatSessionId } = bindKeyOrBinding;
    if (
      chatSessionId &&
      secret.chatSessionId === chatSessionId &&
      (!secret.characterId || secret.characterId === characterId)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * @param {VeilSecret[]} secrets
 * @param {string | ChatBinding} bindKeyOrBinding
 */
export function filterSecretsForBinding(secrets, bindKeyOrBinding) {
  if (!bindKeyOrBinding) return [];
  return secrets.filter((secret) =>
    secretMatchesBinding(secret, bindKeyOrBinding)
  );
}

/**
 * @param {VeilSecret} secret
 * @param {ChatBinding} binding
 */
export function attachChatBinding(secret, binding) {
  return {
    ...secret,
    bindKey: binding.bindKey,
    bindKeyLegacy: binding.bindKeyLegacy,
    chatSessionId: binding.chatSessionId,
    scopeType: "chat",
    scopeId: binding.bindKey,
    characterIndex: binding.charIndex,
    chatIndex: binding.chatIndex,
    characterId: binding.characterId,
    chatLabel: binding.chatLabel,
    characterName: binding.characterName,
    updatedAt: secret.updatedAt || new Date().toISOString(),
  };
}

/**
 * @param {VeilSecret[]} secrets
 * @param {string | ChatBinding} bindKeyOrBinding
 */
export function migrateUnboundSecretsToBinding(secrets, bindKeyOrBinding) {
  const keys =
    typeof bindKeyOrBinding === "string"
      ? [bindKeyOrBinding]
      : getMatchKeys(bindKeyOrBinding);
  const primary = keys[0];
  if (!primary) return 0;

  const hasBound = secrets.some(
    (s) => s.bindKey || s.scopeType === "chat" || s.chatSessionId
  );
  if (hasBound) return 0;

  let count = 0;
  for (const secret of secrets) {
    if (!secret.bindKey) {
      const patch = {
        bindKey: primary,
        scopeType: "chat",
        scopeId: primary,
      };
      if (typeof bindKeyOrBinding !== "string") {
        Object.assign(patch, {
          bindKeyLegacy: bindKeyOrBinding.bindKeyLegacy,
          chatSessionId: bindKeyOrBinding.chatSessionId,
          characterId: bindKeyOrBinding.characterId,
          characterIndex: bindKeyOrBinding.charIndex,
          chatIndex: bindKeyOrBinding.chatIndex,
        });
      }
      Object.assign(secret, patch);
      count += 1;
    }
  }
  return count;
}

/**
 * @param {Record<string, unknown>} ctx
 * @param {ChatBinding | null} binding
 */
export function enrichContextWithBinding(ctx, binding) {
  if (!binding) return { ...ctx };
  return {
    ...ctx,
    bind_key: binding.bindKey,
    chat_bind_key: binding.bindKey,
    chat_id: binding.bindKey,
    chat_session_id: binding.chatSessionId,
    character_id: binding.characterId,
    character_index: binding.charIndex,
    chat_index: binding.chatIndex,
    character_ids: [binding.characterId],
  };
}

/**
 * @param {import('./risu-types.js').RisuaiPluginApi} [Risuai]
 * @param {VeilSecret[]} allSecrets
 * @param {Record<string, unknown>} [ctx]
 */
export async function resolveScopedSecrets(Risuai, allSecrets, ctx = {}) {
  const bindResult = await resolveChatBindingSafe(Risuai);
  const binding = bindResult.binding;
  const bindKey =
    (typeof ctx.bind_key === "string" && ctx.bind_key) ||
    (typeof ctx.chat_bind_key === "string" && ctx.chat_bind_key) ||
    binding?.bindKey;

  const scoped = binding
    ? filterSecretsForBinding(allSecrets, binding)
    : bindKey
      ? filterSecretsForBinding(allSecrets, bindKey)
      : [];

  return {
    binding,
    bindResult,
    bindKey,
    scoped,
    context: enrichContextWithBinding(ctx, binding),
  };
}

/**
 * List Risu chats for a character (for session picker).
 * @param {object} character
 * @returns {{ chatIndex: number, chatSessionId: string | null, label: string, bindKey: string, bindKeyLegacy: string }[]}
 */
export function listCharacterChatSessions(character, charIndex) {
  const chats = character?.chats;
  if (!Array.isArray(chats)) return [];
  const characterId = String(character.chaId ?? character.id ?? charIndex);
  return chats.map((chat, chatIndex) => {
    const chatSessionId =
      chat?.id != null && String(chat.id).length > 0
        ? String(chat.id)
        : null;
    const bindKeyLegacy = makeBindKey(charIndex, chatIndex);
    const bindKey = chatSessionId
      ? makeSessionBindKey(characterId, chatSessionId)
      : bindKeyLegacy;
    const label =
      chat?.name || chat?.title || chat?.chatName || `채팅 #${chatIndex + 1}`;
    return {
      chatIndex,
      chatSessionId,
      label,
      bindKey,
      bindKeyLegacy,
      characterId,
    };
  });
}

/**
 * Summarize stored secrets per bind key for one character.
 * @param {VeilSecret[]} secrets
 * @param {string} characterId
 */
export function summarizeSecretSessions(secrets, characterId) {
  /** @type {Map<string, { bindKey: string, label: string, count: number, chatSessionId?: string }>} */
  const map = new Map();
  for (const secret of secrets) {
    if (secret.characterId && secret.characterId !== characterId) continue;
    const key = secret.bindKey || secret.scopeId;
    if (!key) continue;
    const entry = map.get(key) || {
      bindKey: key,
      label:
        secret.chatLabel ||
        (secret.chatSessionId
          ? `세션 ${secret.chatSessionId.slice(0, 8)}…`
          : key),
      count: 0,
      chatSessionId: secret.chatSessionId,
    };
    entry.count += 1;
    if (secret.chatLabel) entry.label = secret.chatLabel;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/**
 * @param {VeilSecret[]} secrets
 * @param {string} secretId
 */
export function removeSecretById(secrets, secretId) {
  const idx = secrets.findIndex((s) => s.id === secretId);
  if (idx < 0) return { ok: false, error: "시크릿을 찾을 수 없습니다." };
  secrets.splice(idx, 1);
  return { ok: true };
}

/**
 * @param {VeilSecret[]} secrets
 * @param {string | ChatBinding} bindKeyOrBinding
 */
export function removeSecretsForBinding(secrets, bindKeyOrBinding) {
  const before = secrets.length;
  for (let i = secrets.length - 1; i >= 0; i -= 1) {
    if (secretMatchesBinding(secrets[i], bindKeyOrBinding)) {
      secrets.splice(i, 1);
    }
  }
  return { ok: true, removed: before - secrets.length };
}
