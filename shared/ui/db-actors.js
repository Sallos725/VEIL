export async function loadDbActors(Risuai) {
  if (!Risuai || !Risuai.getDatabase) {
    return { ok: false, error: "RisuAI API를 사용할 수 없습니다." };
  }

  const db = await Risuai.getDatabase(["characters", "personas"]);
  if (!db) {
    return {
      ok: false,
      error: "DB 접근이 거부되었습니다. RisuAI에서 데이터베이스 접근을 허용해 주세요.",
    };
  }

  const actors = [];

  for (const [index, char] of (db.characters || []).entries()) {
    const id = char.chaId || char.id || `character_${index}`;
    const name = char.name || char.displayName || id;
    actors.push({ id: String(id), name: String(name), type: "character" });
  }

  for (const [index, persona] of (db.personas || []).entries()) {
    const id = persona.id || `persona_${index}`;
    const name = persona.name || persona.displayName || id;
    actors.push({ id: String(id), name: String(name), type: "persona" });
  }

  return { ok: true, actors };
}

export function fillSelect(select, actors, placeholder) {
  select.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = placeholder || "(선택)";
  select.appendChild(empty);
  for (const actor of actors) {
    const opt = document.createElement("option");
    opt.value = actor.id;
    opt.textContent = `[${actor.type}] ${actor.name}`;
    select.appendChild(opt);
  }
}

export function buildContextFromFields(fields, binding) {
  const ctx = { mode: fields.mode?.value || "ic" };
  if (fields.speaker?.value) ctx.speaker_id = fields.speaker.value;
  if (fields.persona?.value) ctx.persona_id = fields.persona.value;
  const listeners = (fields.listeners?.value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (listeners.length) ctx.listener_ids = listeners;
  if (binding?.bindKey) {
    ctx.bind_key = binding.bindKey;
    ctx.chat_bind_key = binding.bindKey;
    ctx.character_id = binding.characterId;
  }
  return ctx;
}
