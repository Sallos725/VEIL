function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "className") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "checked") node.checked = Boolean(v);
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

/**
 * @param {HTMLElement} panel
 * @param {{ Risuai: object, rpSettingsStore: object, replacerStatus?: { ok?: boolean; reason?: string } }} ctx
 */
export function mountRpLinkPanel(panel, ctx) {
  const { Risuai, rpSettingsStore, replacerStatus } = ctx;
  let current = rpSettingsStore.get();

  panel.appendChild(
    el("h2", { className: "veil-section-title", text: "RP 자동 연동" })
  );
  panel.appendChild(
    el("p", {
      className: "veil-sub",
      text: "채팅 생성 시 매칭된 비밀만 메인 LLM에 주입하고, 응답이 단계를 넘으면 자동으로 완화(redact)합니다. replacer 권한이 필요합니다.",
    })
  );

  const statusChip = el("span", { className: "chip off", text: "" });
  const chips = el("div", { className: "veil-chips" });
  chips.appendChild(statusChip);
  panel.appendChild(chips);

  function updateReplacerChip() {
    if (replacerStatus?.ok) {
      statusChip.className = "chip ok";
      statusChip.textContent = "replacer 연동됨";
    } else if (replacerStatus?.reason === "permission_denied") {
      statusChip.className = "chip off";
      statusChip.textContent = "replacer 권한 거부됨";
    } else if (replacerStatus?.reason === "no_replacer_api") {
      statusChip.className = "chip off";
      statusChip.textContent = "replacer API 없음";
    } else {
      statusChip.className = "chip off";
      statusChip.textContent = "replacer 미등록";
    }
  }
  updateReplacerChip();

  const enabledInput = el("input", { type: "checkbox" });
  enabledInput.checked = current.enabled;
  const injectInput = el("input", { type: "checkbox" });
  injectInput.checked = current.injectGuidance;
  const redactInput = el("input", { type: "checkbox" });
  redactInput.checked = current.enforceRedact;
  const noteInput = el("input", { type: "checkbox" });
  noteInput.checked = current.showVeilNote;

  function readForm() {
    return {
      enabled: enabledInput.checked,
      injectGuidance: injectInput.checked,
      enforceRedact: redactInput.checked,
      showVeilNote: noteInput.checked,
    };
  }

  panel.appendChild(
    el("div", { className: "field" }, [
      el("label", {}, [
        enabledInput,
        document.createTextNode(" RP 연동 사용"),
      ]),
    ])
  );
  panel.appendChild(
    el("div", { className: "field" }, [
      el("label", {}, [
        injectInput,
        document.createTextNode(" 요청 전 가이드 주입 (유저 입력과 태그·제목 매칭 시크릿만)"),
      ]),
    ])
  );
  panel.appendChild(
    el("div", { className: "field" }, [
      el("label", {}, [
        redactInput,
        document.createTextNode(" 응답 후 자동 redact (hardBlock·조기 전체 비밀 완화)"),
      ]),
    ])
  );
  panel.appendChild(
    el("div", { className: "field" }, [
      el("label", {}, [
        noteInput,
        document.createTextNode(" redact 시 [VEIL: N건 완화됨] 표시"),
      ]),
    ])
  );

  panel.appendChild(
    el("div", { className: "toolbar" }, [
      el("button", {
        className: "btn btn-primary",
        text: "RP 설정 저장",
        onclick: async () => {
          current = await rpSettingsStore.save(readForm());
          alert("RP 연동 설정이 저장되었습니다.");
        },
      }),
      el("button", {
        className: "btn btn-secondary",
        text: "replacer 권한 요청",
        onclick: async () => {
          let granted = false;
          if (Risuai?.requestPluginPermission) {
            granted = await Risuai.requestPluginPermission("replacer");
          }
          if (granted) {
            alert(
              "replacer 권한이 허용되었습니다. 플러그인을 다시 로드하거나 Risu를 새로고침한 뒤 VEIL을 다시 활성화하세요."
            );
          } else {
            alert(
              "replacer 권한이 거부되었습니다. RisuAI 플러그인 설정에서 VEIL 권한을 확인하세요."
            );
          }
        },
      }),
    ])
  );
}
