import {
  LLM_PROVIDER_IDS,
  LLM_PROVIDERS,
  getProvider,
  buildVertexOpenAiBaseUrl,
  parseVertexProjectId,
  resolveBaseUrlForSettings,
  isLlmSettingsConfigured,
} from "../llm/providers.js";
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

function readForm(state) {
  return {
    providerId: state.providerSelect.value,
    baseUrl: state.baseUrlInput.value.trim(),
    model: state.modelInput.value.trim(),
    apiKey: state.apiKeyInput.value.trim(),
    vertexJson: state.vertexJsonArea.value.trim(),
    vertexLocation: state.vertexLocationInput.value.trim() || "us-central1",
    vertexProjectId: state.vertexProjectInput.value.trim(),
    vertexJsonImported: state.vertexJsonImported,
    sidecarUrl: state.sidecarInput?.value?.trim() || "",
  };
}

function applyProviderDefaults(state, providerId) {
  const p = getProvider(providerId);
  if (providerId !== "custom" && providerId !== "vertex") {
    state.baseUrlInput.value = p.defaultBaseUrl || "";
  }
  if (providerId === "vertex") {
    const project =
      state.vertexProjectInput.value ||
      parseVertexProjectId(state.vertexJsonArea.value) ||
      "";
    state.baseUrlInput.value = buildVertexOpenAiBaseUrl(
      project,
      state.vertexLocationInput.value || "us-central1"
    );
  }
  if (!state.modelInput.value && p.defaultModel) {
    state.modelInput.value = p.defaultModel;
  }
  updateAuthVisibility(state);
}

function updateAuthVisibility(state) {
  const provider = getProvider(state.providerSelect.value);
  const isVertex = provider.authType === "vertexJson";
  state.apiKeyBlock.style.display = isVertex ? "none" : "block";
  state.vertexBlock.style.display = isVertex ? "block" : "none";
  state.apiKeyLabel.textContent = isVertex ? "" : provider.hint || "API 키";
}

function updateStatus(state, settings, pluginOptions) {
  const raw = {
    providerId: settings.providerId,
    baseUrl: resolveBaseUrlForSettings(settings),
    model: settings.model,
    apiKey: settings.apiKey,
    vertexJson: settings.vertexJson,
  };
  const ok = isLlmSettingsConfigured(raw);
  state.statusChip.className = `chip ${ok ? "ok" : "off"}`;
  state.statusChip.textContent = ok
    ? `LLM 준비됨 · ${getProvider(settings.providerId).label}`
    : "LLM 미설정";
  if (settings.vertexJsonImported && settings.vertexJson) {
    state.vertexImportChip.className = "chip ok";
    state.vertexImportChip.textContent =
      "✓ Vertex JSON 저장됨 (한 번만 설정하면 됩니다)";
    state.vertexJsonArea.classList.add("veil-input-ok");
  } else {
    state.vertexImportChip.className = "chip off";
    state.vertexImportChip.textContent = "Vertex JSON 미등록";
    state.vertexJsonArea.classList.remove("veil-input-ok");
  }
}

/**
 * @param {HTMLElement} panel
 * @param {{ Risuai: object, llmStore: object, edition: string, pluginOptions: object, onSaved: (opts: object) => void }} ctx
 */
export function mountLlmSettingsPanel(panel, ctx) {
  const { llmStore, edition, onSaved } = ctx;
  let current = llmStore.get();

  panel.appendChild(
    el("p", {
      className: "veil-sub",
      text: "LLM은 OpenAI 호환 /v1/chat/completions 엔드포인트를 사용합니다. 설정은 pluginStorage에 저장되며, 플러그인 인자 메뉴와 별개입니다.",
    })
  );

  const state = {
    vertexJsonImported: current.vertexJsonImported,
    providerSelect: el("select"),
    baseUrlInput: el("input", { placeholder: "https://api.openai.com/v1" }),
    modelInput: el("input", { placeholder: "모델 ID 직접 입력 (예: gpt-4o-mini)" }),
    apiKeyInput: el("input", {
      type: "password",
      placeholder: "API 키",
      autocomplete: "off",
    }),
    apiKeyLabel: el("label", { text: "" }),
    apiKeyBlock: el("div", { className: "field" }),
    vertexBlock: el("div", { className: "field veil-vertex-block" }),
    vertexJsonArea: el("textarea", {
      placeholder:
        '{ "type": "service_account", "project_id": "...", "private_key": "...", ... }',
    }),
    vertexLocationInput: el("input", { placeholder: "us-central1" }),
    vertexProjectInput: el("input", { placeholder: "project-id (JSON에서 자동)" }),
    vertexImportChip: el("span", { className: "chip off", text: "" }),
    vertexFileInput: el("input", { type: "file", accept: "application/json,.json" }),
    statusChip: el("span", { className: "chip off", text: "" }),
    sidecarInput:
      edition === "full"
        ? el("input", { placeholder: "http://127.0.0.1:6010" })
        : null,
  };

  state.vertexFileInput.style.display = "none";

  for (const id of LLM_PROVIDER_IDS) {
    const p = LLM_PROVIDERS[id];
    state.providerSelect.appendChild(
      el("option", { value: id, text: p.label })
    );
  }

  state.providerSelect.value = current.providerId || "custom";
  state.baseUrlInput.value =
    current.baseUrl || getProvider(current.providerId).defaultBaseUrl || "";
  state.modelInput.value = current.model || "";
  state.apiKeyInput.value = current.apiKey || "";
  state.vertexJsonArea.value = current.vertexJson || "";
  state.vertexLocationInput.value = current.vertexLocation || "us-central1";
  state.vertexProjectInput.value = current.vertexProjectId || "";
  if (state.sidecarInput) {
    state.sidecarInput.value = current.sidecarUrl || "";
  }

  const chips = el("div", { className: "veil-chips" });
  chips.appendChild(state.statusChip);
  chips.appendChild(state.vertexImportChip);
  panel.appendChild(chips);

  panel.appendChild(
    el("div", { className: "field" }, [
      el("label", { text: "LLM 프로바이더" }),
      state.providerSelect,
    ])
  );

  panel.appendChild(
    el("div", { className: "field" }, [
      el("label", { text: "API Base URL (OpenAI 호환)" }),
      state.baseUrlInput,
      el("p", {
        className: "veil-sub",
        text: "Vertex는 프로젝트·리전에 맞게 자동 채워집니다. Custom은 직접 입력.",
      }),
    ])
  );

  panel.appendChild(
    el("div", { className: "field" }, [
      el("label", { text: "모델 ID" }),
      state.modelInput,
    ])
  );

  state.apiKeyBlock.appendChild(state.apiKeyLabel);
  state.apiKeyBlock.appendChild(state.apiKeyInput);
  panel.appendChild(state.apiKeyBlock);

  state.vertexBlock.appendChild(
    el("p", {
      className: "veil-sub",
      text: "Vertex: API 키 대신 서비스 계정 JSON을 사용합니다. 파일을 선택하거나 아래에 붙여넣으세요.",
    })
  );
  state.vertexBlock.appendChild(
    el("button", {
      className: "btn btn-secondary",
      text: "JSON 파일 가져오기",
      onclick: () => state.vertexFileInput.click(),
    })
  );
  state.vertexBlock.appendChild(state.vertexFileInput);
  state.vertexBlock.appendChild(
    el("div", { className: "field" }, [
      el("label", { text: "서비스 계정 JSON" }),
      state.vertexJsonArea,
    ])
  );
  state.vertexBlock.appendChild(
    el("div", { className: "row" }, [
      el("div", { className: "field", style: "flex:1" }, [
        el("label", { text: "GCP 리전" }),
        state.vertexLocationInput,
      ]),
      el("div", { className: "field", style: "flex:1" }, [
        el("label", { text: "프로젝트 ID" }),
        state.vertexProjectInput,
      ]),
    ])
  );
  panel.appendChild(state.vertexBlock);

  if (state.sidecarInput) {
    panel.appendChild(
      el("div", { className: "field" }, [
        el("label", { text: "Sidecar URL (Full, 선택)" }),
        state.sidecarInput,
      ])
    );
  }

  state.providerSelect.addEventListener("change", () => {
    applyProviderDefaults(state, state.providerSelect.value);
  });

  state.vertexJsonArea.addEventListener("input", () => {
    const project = parseVertexProjectId(state.vertexJsonArea.value);
    if (project) state.vertexProjectInput.value = project;
    if (state.providerSelect.value === "vertex") {
      state.baseUrlInput.value = buildVertexOpenAiBaseUrl(
        project,
        state.vertexLocationInput.value
      );
    }
  });

  state.vertexLocationInput.addEventListener("input", () => {
    if (state.providerSelect.value === "vertex") {
      state.baseUrlInput.value = buildVertexOpenAiBaseUrl(
        state.vertexProjectInput.value ||
          parseVertexProjectId(state.vertexJsonArea.value),
        state.vertexLocationInput.value
      );
    }
  });

  state.vertexFileInput.addEventListener("change", async () => {
    const file = state.vertexFileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      JSON.parse(text);
      state.vertexJsonArea.value = text;
      state.vertexJsonImported = true;
      const project = parseVertexProjectId(text);
      if (project) state.vertexProjectInput.value = project;
      if (state.providerSelect.value === "vertex") {
        state.baseUrlInput.value = buildVertexOpenAiBaseUrl(
          project,
          state.vertexLocationInput.value
        );
      }
      state.vertexJsonArea.classList.add("veil-input-ok");
      updateStatus(state, readForm(state), ctx.pluginOptions);
    } catch {
      alert("유효한 JSON 파일이 아닙니다.");
    }
    state.vertexFileInput.value = "";
  });

  panel.appendChild(
    el("div", { className: "toolbar" }, [
      el("button", {
        className: "btn btn-primary",
        text: "설정 저장",
        onclick: async () => {
          const form = readForm(state);
          if (form.providerId === "vertex" && form.vertexJson) {
            try {
              JSON.parse(form.vertexJson);
              form.vertexJsonImported = true;
            } catch {
              alert("Vertex JSON 형식이 올바르지 않습니다.");
              return;
            }
          }
          const saved = await llmStore.save(form);
          current = saved;
          updateStatus(state, saved, ctx.pluginOptions);
          if (onSaved) {
            await onSaved(await ctx.refreshOptions?.());
          }
          alert("LLM 설정이 저장되었습니다.");
        },
      }),
      el("button", {
        className: "btn btn-secondary",
        text: "프로바이더 기본값으로 채우기",
        onclick: () => {
          applyProviderDefaults(state, state.providerSelect.value);
        },
      }),
    ])
  );

  updateAuthVisibility(state);
  updateStatus(state, current, ctx.pluginOptions);
}
