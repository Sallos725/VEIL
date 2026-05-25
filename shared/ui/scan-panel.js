import { collectLorebookEntriesForCharacter } from "../lorebook/collectFromDatabase.js";
import { runLorebookScan } from "../lorebook/run-scan.js";
import { loreEntriesToVeilSecrets } from "../lorebook/direct-register.js";
import {
  attachChatBinding,
  bindingBannerText,
  BINDING_GUIDE,
} from "../chat-binding.js";
import { stageLabelKo } from "./labels.js";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "className") node.className = v;
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

function uniqueId(base, existing) {
  let id = base;
  let n = 1;
  while (existing.has(id)) {
    id = `${base}_${n}`;
    n += 1;
  }
  existing.add(id);
  return id;
}

const METHOD_LABELS = {
  sidecar: "사이드카 LLM",
  plugin_llm: "플러그인 → 외부 LLM",
  heuristic: "로컬 (항목당 1개, LLM 없음)",
};

export function mountScanPanel(panel, ctx) {
  const {
    Risuai,
    secrets,
    store,
    edition,
    pluginOptions,
    binding,
    bindResult = binding
      ? { ok: true, binding, userMessage: "" }
      : { ok: false, binding: null, userMessage: BINDING_GUIDE },
  } = ctx;

  let loreEntries = [];
  let proposals = [];
  const selectedEntryIds = new Set();

  const opts = pluginOptions || {};
  const llmReady = Boolean(opts.llmConfigured);
  const providerLabel = opts.llmSettings?.providerId
    ? opts.llmSettings.providerId.replace(/_/g, " ")
    : "";
  const llmHint = llmReady
    ? `LLM 연결됨 · ${providerLabel} · ${opts.llm?.model || "?"}`
    : "LLM 미설정 — 상단 「LLM 설정」 탭에서 프로바이더·모델을 저장하세요.";

  const bindBanner = el("div", {
    className: bindResult.ok ? "veil-bind-banner" : "veil-bind-banner warn",
    text: bindResult.ok
      ? `현재 채팅: ${binding.label} — 로어 항목은 이 세션에만 등록됩니다.`
      : bindingBannerText(bindResult),
  });

  const llmBanner = el("div", {
    className: `veil-bind-banner${llmReady ? "" : " warn"}`,
    text: llmHint,
  });
  if (llmReady && opts.llm?.baseUrl) {
    llmBanner.title = opts.llm.baseUrl;
  }

  const intro = el("p", {
    className: "veil-sub",
    text:
      "RisuAI 로어북 항목 1개 = VEIL 시크릿 1개입니다. 분할하지 않습니다. 보통 「직접 등록」이면 충분하고, 공개 단계만 LLM에 맡기려면 「LLM 분석」을 쓰세요.",
  });

  const statusLine = el("p", { className: "veil-sub", text: "" });
  const defaultStageField = el("select", {});
  for (const stage of ["hint", "foreshadow", "partial", "sealed"]) {
    defaultStageField.appendChild(
      el("option", {
        value: stage,
        text: `기본 단계: ${stageLabelKo(stage)}`,
      })
    );
  }
  defaultStageField.value = "hint";

  const entryList = el("div", { className: "secret-list" });
  const proposalList = el("div", { className: "secret-list" });

  panel.appendChild(bindBanner);
  panel.appendChild(llmBanner);
  panel.appendChild(intro);
  panel.appendChild(
    el("div", { className: "field" }, [
      el("label", { text: "등록 시 기본 공개 단계" }),
      defaultStageField,
    ])
  );
  panel.appendChild(statusLine);

  const toolbar = el("div", { className: "toolbar" });
  toolbar.appendChild(
    el("button", {
      className: "btn btn-secondary",
      text: "로어북 불러오기",
      onclick: loadLorebook,
    })
  );
  toolbar.appendChild(
    el("button", {
      className: "btn btn-secondary",
      text: "전체 선택",
      onclick: () => {
        for (const e of loreEntries) selectedEntryIds.add(e.id);
        renderEntryList();
      },
    })
  );
  toolbar.appendChild(
    el("button", {
      className: "btn btn-secondary",
      text: "선택 해제",
      onclick: () => {
        selectedEntryIds.clear();
        renderEntryList();
      },
    })
  );
  panel.appendChild(toolbar);
  panel.appendChild(entryList);

  panel.appendChild(
    el("button", {
      className: "btn btn-primary",
      text: "선택 항목 → 시크릿 직접 등록 (1:1)",
      onclick: registerDirect,
    })
  );
  panel.appendChild(
    el("button", {
      className: "btn btn-secondary",
      text: "선택 항목 LLM 분석 (공개 단계 제안)",
      onclick: runLlmScan,
    })
  );
  panel.appendChild(proposalList);
  panel.appendChild(
    el("button", {
      className: "btn btn-primary",
      text: "LLM 제안 등록",
      onclick: registerProposals,
    })
  );

  async function loadLorebook() {
    if (!bindResult.ok || !binding) {
      statusLine.textContent = bindResult.userMessage || BINDING_GUIDE;
      return;
    }
    if (!Risuai?.getDatabase) {
      statusLine.textContent = "RisuAI DB API를 사용할 수 없습니다.";
      return;
    }
    const db = await Risuai.getDatabase(["characters"]);
    if (!db) {
      statusLine.textContent =
        "DB 접근 거부. RisuAI 설정에서 데이터베이스 접근을 허용하세요.";
      return;
    }
    loreEntries = collectLorebookEntriesForCharacter(
      db,
      binding.charIndex,
      binding.chatIndex
    );
    selectedEntryIds.clear();
    proposals = [];
    proposalList.innerHTML = "";

    if (!loreEntries.length) {
      statusLine.textContent =
        "로어북 항목 없음 (globalLore / localLore 확인)";
    } else {
      statusLine.textContent = `${loreEntries.length}개 로어 항목 — 체크 후 「직접 등록」 또는 「LLM 분석」`;
    }
    renderEntryList();
  }

  function getSelectedEntries() {
    return loreEntries.filter((e) => selectedEntryIds.has(e.id));
  }

  async function registerDirect() {
    if (!binding) {
      alert("채팅 바인딩이 필요합니다.");
      return;
    }
    const selected = getSelectedEntries();
    if (!selected.length) {
      alert("등록할 로어 항목을 선택하세요.");
      return;
    }
    const existing = new Set(secrets.map((s) => s.id));
    const batch = loreEntriesToVeilSecrets(selected, binding, {
      defaultStage: defaultStageField.value,
      existingIds: existing,
    });
    for (const s of batch) secrets.push(s);
    await store.save(secrets);
    alert(
      `${batch.length}개 로어 항목을 시크릿으로 등록했습니다. (항목당 1개, 분할 없음)`
    );
    statusLine.textContent = `등록 완료: ${batch.length}개`;
  }

  async function runLlmScan() {
    if (!binding) {
      alert("채팅 바인딩이 필요합니다.");
      return;
    }
    const selected = getSelectedEntries();
    if (!selected.length) {
      alert("분석할 로어 항목을 선택하세요.");
      return;
    }
    statusLine.textContent = "LLM 분석 중… (항목당 제안 1개)";
    const result = await runLorebookScan({
      entries: selected,
      options: {
        default_stage: defaultStageField.value,
        language: "ko",
      },
      sidecarUrl: opts.sidecarUrl || undefined,
      llm: opts.llmRaw || opts.llm || {},
      preferPluginLlm: edition === "lite" || !opts.sidecarUrl,
    });

    proposals = result.proposals || [];
    const methodLabel = METHOD_LABELS[result.method] || result.method;
    if (proposals.length) {
      statusLine.textContent = `제안 ${proposals.length}개 · ${methodLabel}`;
    } else {
          statusLine.textContent = `제안 없음 (${methodLabel}) — 「직접 등록」을 사용하거나 LLM 설정 탭을 확인하세요. ${result.error || ""}`;
    }
    renderProposals();
  }

  async function registerProposals() {
    if (!binding) {
      alert("채팅 바인딩이 필요합니다.");
      return;
    }
    const existing = new Set(secrets.map((s) => s.id));
    let added = 0;
    for (const card of proposalList.querySelectorAll("[data-proposal-id]")) {
      const checkbox = card.querySelector("input[type=checkbox]");
      if (!checkbox?.checked) continue;
      const id = card.dataset.proposalId;
      const p = proposals.find((x) => x.id === id);
      if (!p) continue;
      const newId = uniqueId(p.id, existing);
      secrets.push(
        attachChatBinding(
          { ...p, id: newId, createdAt: new Date().toISOString() },
          binding
        )
      );
      added += 1;
    }
    if (!added) {
      alert("등록할 제안을 선택하세요.");
      return;
    }
    await store.save(secrets);
    alert(`${added}개 시크릿을 등록했습니다.`);
  }

  function renderEntryList() {
    entryList.innerHTML = "";
    if (!loreEntries.length) {
      entryList.appendChild(
        el("p", {
          className: "veil-sub",
          text: "「로어북 불러오기」로 globalLore / localLore 항목을 가져오세요.",
        })
      );
      return;
    }

    for (const entry of loreEntries) {
      const card = el("label", { className: "card veil-check-row" });
      const cb = el("input", { type: "checkbox" });
      cb.checked = selectedEntryIds.has(entry.id);
      cb.addEventListener("change", () => {
        if (cb.checked) selectedEntryIds.add(entry.id);
        else selectedEntryIds.delete(entry.id);
        renderEntryList();
      });

      const layerLabel =
        entry.sourceLayer === "localLore" ? "채팅 로어" : "캐릭터 로어";
      const title = entry.loreTitle || entry.source;
      const keys = entry.loreKeys
        ? `키: ${String(entry.loreKeys).slice(0, 100)}`
        : "키: (없음)";
      const preview =
        entry.text.length > 120
          ? `${entry.text.slice(0, 120)}…`
          : entry.text;

      const labelBox = el("div", { className: "veil-check-label" });
      labelBox.appendChild(el("strong", { text: `[${layerLabel}] ${title}` }));
      labelBox.appendChild(el("p", { className: "veil-sub", text: keys }));
      labelBox.appendChild(el("p", { className: "veil-sub", text: preview }));

      const details = el("details");
      details.appendChild(el("summary", { text: "전체 본문" }));
      details.appendChild(el("p", { text: entry.text }));

      card.appendChild(cb);
      card.appendChild(labelBox);
      card.appendChild(details);
      entryList.appendChild(card);
    }
  }

  function renderProposals() {
    proposalList.innerHTML = "";
    if (!proposals.length) return;

    for (const p of proposals) {
      const card = el("div", {
        className: "card veil-check-row",
        "data-proposal-id": p.id,
      });
      const cb = el("input", { type: "checkbox" });
      cb.checked = true;
      const label = el("div", { className: "veil-check-label" });
      label.appendChild(
        el("strong", {
          text: `${p.title} · ${stageLabelKo(p.revealStage)}`,
        })
      );
      label.appendChild(
        el("p", {
          className: "veil-sub",
          text: `신뢰도: ${p.confidence || "medium"}`,
        })
      );
      const details = el("details");
      details.appendChild(el("summary", { text: "제안 fullSecret" }));
      details.appendChild(el("p", { text: p.fullSecret }));
      card.appendChild(cb);
      card.appendChild(label);
      card.appendChild(details);
      proposalList.appendChild(card);
    }
  }
}
