/**
 * @typedef {object} VeilSecret
 */

/**
 * @typedef {object} ChatBinding
 * @property {string} bindKey
 * @property {number} charIndex
 * @property {number} chatIndex
 * @property {string} characterId
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
 * @param {number} charIndex
 * @param {number} chatIndex
 */
export function makeBindKey(charIndex, chatIndex) {
  return `${charIndex}:${chatIndex}`;
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
  const chatLabel =
    chat.name || chat.title || chat.chatName || `채팅 #${chatIndex + 1}`;
  const bindKey = makeBindKey(charIndex, chatIndex);

  return ok({
    bindKey,
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
    return `연결된 채팅: ${result.binding.label} — 이 봇·세션에만 시크릿이 적용됩니다.`;
  }
  return result.userMessage || BINDING_GUIDE;
}

/**
 * @param {VeilSecret[]} secrets
 * @param {string | undefined} bindKey
 */
export function filterSecretsForBinding(secrets, bindKey) {
  if (!bindKey) return [];
  return secrets.filter((secret) => secretMatchesBinding(secret, bindKey));
}

export function secretMatchesBinding(secret, bindKey) {
  if (!bindKey) return false;
  if (secret.bindKey === bindKey) return true;
  if (secret.scopeType === "chat" && secret.scopeId === bindKey) return true;
  return false;
}

/**
 * @param {VeilSecret} secret
 * @param {ChatBinding} binding
 */
export function attachChatBinding(secret, binding) {
  return {
    ...secret,
    bindKey: binding.bindKey,
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
 * @param {string} bindKey
 */
export function migrateUnboundSecretsToBinding(secrets, bindKey) {
  const hasBound = secrets.some((s) => s.bindKey || s.scopeType === "chat");
  if (hasBound) return 0;

  let count = 0;
  for (const secret of secrets) {
    if (!secret.bindKey) {
      Object.assign(secret, {
        bindKey,
        scopeType: "chat",
        scopeId: bindKey,
      });
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

  const scoped = bindKey
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
