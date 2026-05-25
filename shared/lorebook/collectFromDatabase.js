const CHUNK_SIZE = 3500;
const MIN_LORE_CONTENT_LEN = 8;

const TEXT_FIELD_KEYS = [
  "description",
  "desc",
  "personality",
  "scenario",
  "firstMessage",
  "mes_example",
  "systemPrompt",
  "postHistoryInstructions",
  "notes",
  "note",
  "bio",
  "summary",
];

/** RisuAI native lorebook arrays on character / chat */
const RISU_LORE_ARRAY_KEYS = ["globalLore", "localLore"];

/** Legacy / import card lorebook field names */
const LEGACY_LORE_KEYS = [
  "lorebook",
  "loreBook",
  "loreBooks",
  "lorebooks",
  "embeddings",
  "worldInfo",
  "worldinfo",
  "books",
];

function slug(value) {
  return String(value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

function pushText(parts, label, value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > 20) parts.push({ label, text });
}

function loreEntryDisplayName(item, index) {
  const comment = typeof item.comment === "string" ? item.comment.trim() : "";
  if (comment) return comment;
  const key = typeof item.key === "string" ? item.key.trim() : "";
  if (key) {
    const first = key.split(/[\n,]/)[0].trim();
    if (first) return first.slice(0, 48);
  }
  return `entry_${index}`;
}

/**
 * RisuAI loreBook[] — 항목당 VEIL 스캔 단위 1개 (분할·청크 없음).
 */
function risuLoreArrayToEntries(arr, layer, rid, charName, entries) {
  if (!Array.isArray(arr)) return;
  for (const [i, item] of arr.entries()) {
    if (!item || typeof item !== "object") continue;
    if (item.mode === "folder") continue;
    const content = typeof item.content === "string" ? item.content.trim() : "";
    if (content.length < MIN_LORE_CONTENT_LEN) continue;
    const title = loreEntryDisplayName(item, i);
    const stableId = item.id
      ? `${rid}:${layer}:${item.id}`
      : `${rid}:${layer}:${i}`;
    entries.push({
      id: stableId,
      loreIndex: i,
      loreLayer: layer,
      loreTitle: title,
      loreKeys: typeof item.key === "string" ? item.key : "",
      alwaysActive: Boolean(item.alwaysActive),
      source: title,
      sourceType: "lorebook",
      sourceLayer: layer,
      sourceName: charName,
      sourceId: String(rid),
      text: content,
      tags: ["lorebook", layer, slug(title)],
    });
  }
}

/**
 * @param {object[]} arr
 * @param {string} prefix
 * @param {{ label: string, text: string, loreKeys?: string }[]} parts
 */
function extractRisuLoreBookArray(arr, prefix, parts) {
  if (!Array.isArray(arr)) return;
  for (const [i, item] of arr.entries()) {
    if (!item || typeof item !== "object") continue;
    if (item.mode === "folder") continue;
    const content = typeof item.content === "string" ? item.content.trim() : "";
    if (content.length < MIN_LORE_CONTENT_LEN) continue;
    const name = loreEntryDisplayName(item, i);
    parts.push({
      label: `${prefix}[${name}]`,
      text: content,
      loreKeys: typeof item.key === "string" ? item.key : undefined,
    });
  }
}

function legacyLoreArrayToEntries(arr, layer, rid, charName, entries, offset = 0) {
  if (!Array.isArray(arr)) return;
  for (const [i, item] of arr.entries()) {
    let content = "";
    let title = `entry_${i}`;
    let keys = "";
    if (typeof item === "string") {
      content = item.trim();
    } else if (item && typeof item === "object") {
      content = String(
        item.content || item.text || item.entry || item.value || item.prompt || ""
      ).trim();
      keys = typeof item.key === "string" ? item.key : "";
      title = item.comment || item.name || loreEntryDisplayName(item, i);
    }
    if (content.length < MIN_LORE_CONTENT_LEN) continue;
    entries.push({
      id: `${rid}:legacy:${layer}:${offset + i}`,
      loreIndex: offset + i,
      loreLayer: layer,
      loreTitle: title,
      loreKeys: keys,
      source: title,
      sourceType: "lorebook",
      sourceLayer: "legacy",
      sourceName: charName,
      sourceId: String(rid),
      text: content,
      tags: ["lorebook", "legacy"],
    });
  }
}

function extractFromLorebookArray(arr, prefix, parts) {
  if (!Array.isArray(arr)) return;
  for (const [i, item] of arr.entries()) {
    if (typeof item === "string") {
      pushText(parts, `${prefix}[${i}]`, item);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const content =
      item.content || item.text || item.entry || item.value || item.prompt;
    pushText(parts, `${prefix}[${i}]`, content);
  }
}

function extractLegacyLoreFields(record, prefix, parts) {
  for (const key of LEGACY_LORE_KEYS) {
    const val = record[key];
    if (Array.isArray(val)) {
      extractFromLorebookArray(val, `${prefix}.${key}`, parts);
    } else if (val && typeof val === "object") {
      if (Array.isArray(val.entries)) {
        extractFromLorebookArray(val.entries, `${prefix}.${key}.entries`, parts);
      } else {
        pushText(parts, `${prefix}.${key}`, JSON.stringify(val).slice(0, CHUNK_SIZE));
      }
    }
  }
}

function extractTextsFromRecord(record, prefix) {
  const parts = [];
  if (!record || typeof record !== "object") return parts;

  for (const key of TEXT_FIELD_KEYS) {
    pushText(parts, `${prefix}.${key}`, record[key]);
  }

  for (const key of RISU_LORE_ARRAY_KEYS) {
    extractRisuLoreBookArray(record[key], `${prefix}.${key}`, parts);
  }
  extractLegacyLoreFields(record, prefix, parts);

  return parts;
}

function chunkText(text, source, sourceType, sourceName) {
  const chunks = [];
  if (text.length <= CHUNK_SIZE) {
    chunks.push({ source, sourceType, sourceName, text });
    return chunks;
  }
  let offset = 0;
  let part = 0;
  while (offset < text.length) {
    chunks.push({
      source: `${source}#${part}`,
      sourceType,
      sourceName,
      text: text.slice(offset, offset + CHUNK_SIZE),
    });
    offset += CHUNK_SIZE;
    part += 1;
  }
  return chunks;
}

function partsToEntries(parts, rid, type, name) {
  const entries = [];
  for (const part of parts) {
    const layer = part.label.startsWith("globalLore")
      ? "globalLore"
      : part.label.startsWith("localLore")
        ? "localLore"
        : "other";
    for (const chunk of chunkText(part.text, part.label, type, name)) {
      entries.push({
        id: `${rid}_${slug(part.label)}_${entries.length}`,
        source: chunk.source,
        sourceType: type,
        sourceLayer: layer,
        sourceName: name,
        sourceId: String(rid),
        text: chunk.text,
        tags: [type, slug(name)],
        loreKeys: part.loreKeys,
      });
    }
  }
  return entries;
}

function collectFromRecord(record, type, idKey, index, entries) {
  const name = record.name || record.displayName || `${type}_${index}`;
  const rid = record[idKey] || record.id || `${type}_${index}`;
  const prefix = `${type}:${slug(name)}`;
  const parts = extractTextsFromRecord(record, prefix);
  entries.push(...partsToEntries(parts, rid, type, name));
}

/**
 * RisuAI 로어북만 수집 (globalLore + 현재 채팅 localLore).
 * firstMessage·desc 등 일반 필드는 포함하지 않습니다.
 *
 * @param {object} db
 * @param {number} charIndex
 * @param {number | null} [chatIndex]
 */
export function collectLorebookEntriesForCharacter(db, charIndex, chatIndex = null) {
  if (!db || !Array.isArray(db.characters)) return [];
  const record = db.characters[charIndex];
  if (!record) return [];

  const name = record.name || record.displayName || `character_${charIndex}`;
  const rid = record.chaId || record.id || String(charIndex);
  const entries = [];

  risuLoreArrayToEntries(record.globalLore, "globalLore", rid, name, entries);

  if (chatIndex != null && Array.isArray(record.chats)) {
    const chat = record.chats[chatIndex];
    if (chat) {
      risuLoreArrayToEntries(chat.localLore, "localLore", rid, name, entries);
    }
  }

  for (const key of LEGACY_LORE_KEYS) {
    const val = record[key];
    if (Array.isArray(val)) {
      legacyLoreArrayToEntries(val, key, rid, name, entries);
    } else if (val && typeof val === "object" && Array.isArray(val.entries)) {
      legacyLoreArrayToEntries(val.entries, `${key}.entries`, rid, name, entries);
    }
  }

  return entries;
}

/**
 * @deprecated 스캔 탭은 collectLorebookEntriesForCharacter 사용
 */
export function collectLoreEntriesForCharacter(db, charIndex, chatIndex = null) {
  return collectLorebookEntriesForCharacter(db, charIndex, chatIndex);
}

export function collectLoreEntries(db) {
  if (!db) return [];

  const entries = [];

  const sources = [
    { list: db.characters, type: "character", idKey: "chaId" },
    { list: db.personas, type: "persona", idKey: "id" },
    { list: db.modules, type: "module", idKey: "id" },
  ];

  for (const { list, type, idKey } of sources) {
    if (!Array.isArray(list)) continue;
    for (const [index, record] of list.entries()) {
      collectFromRecord(record, type, idKey, index, entries);
    }
  }

  return entries;
}
