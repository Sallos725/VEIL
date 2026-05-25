import { VEIL_STAGE_ORDER } from "../revealStages.js";
import { stageLabelKo } from "./labels.js";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "className") node.className = v;
    else if (k === "value") node.value = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === "string") node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  }
  return node;
}

function splitLines(text) {
  if (!text || !String(text).trim()) return [];
  return String(text)
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinLines(arr) {
  return Array.isArray(arr) ? arr.join("\n") : "";
}

/**
 * @param {Document} doc
 * @param {object} secret
 * @param {{ onSave: (secret: object) => Promise<void> | void }} opts
 */
export function mountSecretEditor(doc, secret, opts) {
  const wrap = el("div", { className: "veil-secret-editor" });

  const titleInput = el("input", {
    className: "veil-input",
    type: "text",
    value: secret.title || "",
  });
  wrap.appendChild(el("label", { className: "veil-label", text: "제목" }));
  wrap.appendChild(titleInput);

  const stageSelect = el("select", { className: "veil-select" });
  for (const stage of VEIL_STAGE_ORDER) {
    const opt = el("option", {
      value: stage,
      text: stageLabelKo(stage),
    });
    if (secret.revealStage === stage) opt.selected = true;
    stageSelect.appendChild(opt);
  }
  wrap.appendChild(el("label", { className: "veil-label", text: "공개 단계" }));
  wrap.appendChild(stageSelect);

  const fullSecretArea = el("textarea", {
    className: "veil-textarea",
    rows: "4",
    value: secret.fullSecret || "",
  });
  wrap.appendChild(el("label", { className: "veil-label", text: "전체 비밀 (fullSecret)" }));
  wrap.appendChild(fullSecretArea);

  const ladderFields = [
    ["foreshadow", "암시 (foreshadow, 줄마다)"],
    ["hint", "단서 (hint)"],
    ["partial", "부분 (partial)"],
    ["nearReveal", "거의 공개 (nearReveal)"],
  ];
  const ladderAreas = {};
  for (const [key, label] of ladderFields) {
    const area = el("textarea", {
      className: "veil-textarea veil-textarea-sm",
      rows: "2",
      value: joinLines(secret.revealLadder?.[key]),
    });
    ladderAreas[key] = area;
    wrap.appendChild(el("label", { className: "veil-label", text: label }));
    wrap.appendChild(area);
  }

  const revealedArea = el("textarea", {
    className: "veil-textarea veil-textarea-sm",
    rows: "2",
    value: secret.revealLadder?.revealed || "",
  });
  wrap.appendChild(el("label", { className: "veil-label", text: "완전 공개 (revealed)" }));
  wrap.appendChild(revealedArea);

  const knownInput = el("input", {
    className: "veil-input",
    type: "text",
    value: (secret.knownBy || []).join(", "),
  });
  const unknownInput = el("input", {
    className: "veil-input",
    type: "text",
    value: (secret.unknownBy || []).join(", "),
  });
  const hardInput = el("input", {
    className: "veil-input",
    type: "text",
    value: (secret.hardBlocks || []).join(", "),
  });
  const tagsInput = el("input", {
    className: "veil-input",
    type: "text",
    value: (secret.tags || []).join(", "),
  });

  wrap.appendChild(el("label", { className: "veil-label", text: "앎 (knownBy, 쉼표)" }));
  wrap.appendChild(knownInput);
  wrap.appendChild(el("label", { className: "veil-label", text: "모름 (unknownBy)" }));
  wrap.appendChild(unknownInput);
  wrap.appendChild(el("label", { className: "veil-label", text: "금지 표현 (hardBlocks)" }));
  wrap.appendChild(hardInput);
  wrap.appendChild(el("label", { className: "veil-label", text: "태그" }));
  wrap.appendChild(tagsInput);

  const statusEl = el("p", { className: "veil-sub", text: "" });

  wrap.appendChild(
    el("button", {
      className: "btn btn-primary",
      text: "편집 내용 저장",
      onclick: async () => {
        const title = titleInput.value.trim();
        if (!title) {
          statusEl.textContent = "제목을 입력하세요.";
          return;
        }
        const next = {
          ...secret,
          title,
          revealStage: stageSelect.value,
          fullSecret: fullSecretArea.value.trim(),
          revealLadder: {
            foreshadow: splitLines(ladderAreas.foreshadow.value),
            hint: splitLines(ladderAreas.hint.value),
            partial: splitLines(ladderAreas.partial.value),
            nearReveal: splitLines(ladderAreas.nearReveal.value),
            revealed: revealedArea.value.trim() || undefined,
          },
          knownBy: splitLines(knownInput.value.replace(/,/g, "\n")),
          unknownBy: splitLines(unknownInput.value.replace(/,/g, "\n")),
          hardBlocks: splitLines(hardInput.value.replace(/,/g, "\n")),
          tags: splitLines(tagsInput.value.replace(/,/g, "\n")),
          updatedAt: new Date().toISOString(),
        };
        try {
          await opts.onSave(next);
          statusEl.textContent = "저장되었습니다.";
        } catch (e) {
          statusEl.textContent = e?.message || String(e);
        }
      },
    })
  );
  wrap.appendChild(statusEl);

  return wrap;
}

/**
 * @param {HTMLElement} card
 * @param {Document} doc
 * @param {object} secret
 * @param {{ onSave: (s: object) => Promise<void> | void }} opts
 */
export function attachSecretEditorToCard(card, doc, secret, opts) {
  const details = el("details", { className: "details veil-secret-details" });
  details.appendChild(el("summary", { text: "상세 편집" }));
  details.appendChild(mountSecretEditor(doc, secret, opts));
  card.appendChild(details);
}
