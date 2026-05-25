import { DASHBOARD_CSS } from "./styles.js";
import {
  stageLabelKo,
  sourceLabelKo,
  formatViolation,
  riskLabelKo,
} from "./labels.js";
import {
  makeGuidance,
  checkDisclosure,
  getAllowedDisclosures,
  advanceRevealStage,
} from "../core.js";
import { VEIL_STAGE_ORDER } from "../revealStages.js";
import { loadDbActors, fillSelect, buildContextFromFields } from "./db-actors.js";
import { mountScanPanel } from "./scan-panel.js";
import { mountLlmSettingsPanel } from "./llm-settings-panel.js";
import {
  resolveChatBindingSafe,
  bindingBannerText,
  BINDING_GUIDE,
  filterSecretsForBinding,
  migrateUnboundSecretsToBinding,
  attachChatBinding,
} from "../chat-binding.js";
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

function nextStage(current) {
  const idx = VEIL_STAGE_ORDER.indexOf(current);
  if (idx < 0 || idx >= VEIL_STAGE_ORDER.length - 1) return null;
  return VEIL_STAGE_ORDER[idx + 1];
}

function maskTitle(secret) {
  return secret.revealStage === "sealed" ? "[비공개]" : secret.title;
}

export async function openDashboard(doc, ctx) {
  const {
    Risuai,
    secrets,
    store,
    edition,
    resolveSidecarUrl,
    pluginOptions: initialPluginOptions,
    llmStore,
    refreshOptions,
  } = ctx;
  let pluginOptions = initialPluginOptions || {};
  let activeTab = "secrets";
  let status = store.getStatus();

  const bindResult = await resolveChatBindingSafe(Risuai);
  const binding = bindResult.binding;
  if (binding) {
    const migrated = migrateUnboundSecretsToBinding(secrets, binding.bindKey);
    if (migrated > 0) await store.save(secrets);
  }

  function getBoundSecrets() {
    if (!bindResult.ok || !binding?.bindKey) return [];
    return filterSecretsForBinding(secrets, binding.bindKey);
  }

  if (edition === "full" && store.refreshHealth) {
    await store.refreshHealth();
    status = store.getStatus();
  }

  const root = doc.createElement("div");
  root.className = "veil-app";
  doc.body.innerHTML = "";
  doc.head.innerHTML = `<meta charset="utf-8"><style>${DASHBOARD_CSS}</style>`;
  doc.body.appendChild(root);

  const header = el("div", { className: "veil-header" });
  const titleBlock = el("div", {}, [
    el("h1", { className: "veil-title", text: "VEIL — 비밀 공개 관리" }),
    el("p", {
      className: "veil-sub",
      text: "단계에 맞게 비밀을 암시하고, 스포일러를 막습니다.",
    }),
  ]);
  const chips = el("div", { className: "veil-chips" });
  const storageChip = el("span", {
    className: "chip",
    text: `저장: ${sourceLabelKo(status.source)}`,
  });
  chips.appendChild(storageChip);

  let sidecarChip = null;
  if (edition === "full") {
    sidecarChip = el("span", {
      className: `chip ${status.sidecarOnline ? "ok" : "off"}`,
      text: status.sidecarOnline ? "사이드카 연결됨" : "사이드카 오프라인",
    });
    chips.appendChild(sidecarChip);
  }

  const closeBtn = el("button", {
    className: "btn btn-secondary",
    text: "닫기",
    onclick: async () => {
      if (Risuai && Risuai.hideContainer) await Risuai.hideContainer();
    },
  });

  header.appendChild(titleBlock);
  header.appendChild(chips);
  header.appendChild(closeBtn);
  root.appendChild(header);

  const bindBanner = el("div", {
    className: bindResult.ok ? "veil-bind-banner" : "veil-bind-banner warn",
    text: bindingBannerText(bindResult),
  });
  root.appendChild(bindBanner);

  if (!bindResult.ok) {
    const guideCard = el("div", { className: "card" });
    guideCard.appendChild(
      el("h3", { text: "채팅 연결이 필요합니다" })
    );
    guideCard.appendChild(
      el("p", { text: bindResult.userMessage || BINDING_GUIDE })
    );
    guideCard.appendChild(
      el("ol", {}, [
        el("li", {
          text: "RisuAI 왼쪽에서 사용할 봇(캐릭터)을 선택합니다.",
        }),
        el("li", { text: "해당 봇의 채팅을 연 상태로 둡니다." }),
        el("li", {
          text: "햄버거 메뉴 또는 채팅 도구 모음 → VEIL을 다시 엽니다.",
        }),
      ])
    );
    if (bindResult.detail) {
      guideCard.appendChild(
        el("p", {
          className: "veil-sub",
          text: `기술 정보: ${bindResult.detail}`,
        })
      );
    }
    root.appendChild(guideCard);
  }

  const tabs = el("div", { className: "veil-tabs" });
  const panels = {};
  const tabNames = [
    ["secrets", "시크릿"],
    ["check", "검사"],
    ["guide", "가이드"],
    ["scan", "스캔"],
    ["settings", "LLM 설정"],
  ];

  function setTab(name) {
    activeTab = name;
    tabs.querySelectorAll(".veil-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === name);
    });
    Object.entries(panels).forEach(([k, panel]) => {
      panel.classList.toggle("active", k === name);
    });
  }

  for (const [id, label] of tabNames) {
    const btn = el("button", {
      className: `veil-tab${id === activeTab ? " active" : ""}`,
      text: label,
      "data-tab": id,
      onclick: () => setTab(id),
    });
    tabs.appendChild(btn);
    panels[id] = el("div", { className: `veil-panel${id === activeTab ? " active" : ""}` });
    root.appendChild(panels[id]);
  }
  root.insertBefore(tabs, panels.secrets);

  // --- Secrets panel ---
  const secretsToolbar = el("div", { className: "toolbar" });
  const importInput = el("input", { type: "file", accept: "application/json,.json" });
  importInput.style.display = "none";
  secretsToolbar.appendChild(
    el("button", {
      className: "btn btn-secondary",
      text: "JSON 가져오기",
      onclick: () => importInput.click(),
    })
  );
  secretsToolbar.appendChild(
    el("button", {
      className: "btn btn-secondary",
      text: "JSON보내기",
      onclick: async () => {
        const data = await store.exportSecrets();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const a = doc.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "veil-secrets.json";
        a.click();
        URL.revokeObjectURL(a.href);
      },
    })
  );
  secretsToolbar.appendChild(
    el("button", {
      className: "btn btn-primary",
      text: "저장",
      onclick: async () => {
        const result = await store.save(secrets);
        status = store.getStatus();
        storageChip.textContent = `저장: ${sourceLabelKo(status.source)}`;
        if (sidecarChip) {
          sidecarChip.className = `chip ${status.sidecarOnline ? "ok" : "off"}`;
          sidecarChip.textContent = status.sidecarOnline
            ? "사이드카 연결됨"
            : "사이드카 오프라인";
        }
        alert(
          result.sidecarSynced === false && edition === "full"
            ? "로컬 캐시에 저장됨 (사이드카 동기화 실패)"
            : "저장되었습니다."
        );
      },
    })
  );
  panels.secrets.appendChild(secretsToolbar);
  panels.secrets.appendChild(importInput);

  importInput.addEventListener("change", async () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      let list = Array.isArray(parsed) ? parsed : parsed.secrets;
      if (binding && Array.isArray(list)) {
        list = list.map((s) => attachChatBinding(s, binding));
      }
      const result = await store.importSecrets(list);
      if (!result.ok) {
        alert(result.error || "가져오기 실패");
        return;
      }
      const loaded = await store.load();
      secrets.length = 0;
      secrets.push(...loaded.secrets);
      status = store.getStatus();
      renderSecretCards();
      alert("가져오기 완료");
    } catch (e) {
      alert("JSON 파싱 오류: " + (e.message || e));
    }
    importInput.value = "";
  });

  const secretList = el("div", { className: "secret-list" });
  panels.secrets.appendChild(secretList);

  function renderSecretCards() {
    secretList.innerHTML = "";
    const bound = getBoundSecrets();
    if (!bindResult.ok) {
      secretList.appendChild(
        el("p", {
          className: "veil-sub",
          text: bindResult.userMessage || BINDING_GUIDE,
        })
      );
      return;
    }
    if (!bound.length) {
      secretList.appendChild(
        el("p", {
          className: "veil-sub",
          text: "이 채팅에 등록된 시크릿이 없습니다. 스캔 탭에서 로어북을 제안·등록하세요.",
        })
      );
      return;
    }
    for (const secret of bound) {
      const ns = nextStage(secret.revealStage);
      const card = el("div", { className: "card" });
      card.appendChild(
        el("h3", { text: maskTitle(secret) })
      );
      const meta = el("div", { className: "row" });
      meta.appendChild(
        el("span", {
          className: "badge",
          text: stageLabelKo(secret.revealStage),
        })
      );
      meta.appendChild(
        el("span", {
          className: "badge",
          text: secret.bindKey || `${secret.scopeType}:${secret.scopeId}`,
        })
      );
      card.appendChild(meta);
      const known =
        secret.knownBy?.length > 0
          ? secret.knownBy.join(", ")
          : "(미지정)";
      const unknown =
        secret.unknownBy?.length > 0
          ? secret.unknownBy.join(", ")
          : "(없음)";
      card.appendChild(
        el("p", {
          className: "veil-sub",
          text: `앎: ${known} · 모름: ${unknown}`,
        })
      );

      if (ns) {
        card.appendChild(
          el("button", {
            className: "btn btn-primary",
            text: `다음 단계 (${stageLabelKo(ns)})`,
            onclick: async () => {
              const result = advanceRevealStage(secrets, secret.id, ns, {
                manual: true,
                reason: "gui",
              });
              if (!result.ok) {
                alert(result.error || "단계 변경 실패");
                return;
              }
              await store.save(secrets);
              status = store.getStatus();
              renderSecretCards();
            },
          })
        );
      }

      const disclosures = getAllowedDisclosures(secret, {});
      const details = el("details", { className: "details" });
      details.appendChild(el("summary", { text: "허용 표현 보기" }));
      if (disclosures.length === 0) {
        details.appendChild(el("p", { text: "(현재 단계에서 허용되는 직접 표현 없음)" }));
      } else {
        const ul = el("ul");
        for (const line of disclosures) {
          ul.appendChild(el("li", { text: line }));
        }
        details.appendChild(ul);
      }
      if (secret.hardBlocks && secret.hardBlocks.length) {
        details.appendChild(el("p", { text: `금지 구문: ${secret.hardBlocks.join(", ")}` }));
      }
      if (secret.revealStage === "revealed" && secret.fullSecret) {
        details.appendChild(el("p", { text: `전체 비밀: ${secret.fullSecret}` }));
      } else if (secret.fullSecret) {
        details.appendChild(el("p", { text: "전체 비밀: •••• (완전 공개 후 표시)" }));
      }
      card.appendChild(details);
      secretList.appendChild(card);
    }
  }
  renderSecretCards();

  const dbActors = await loadDbActors(Risuai);
  const actorHint = el("p", {
    className: "veil-sub",
    text: dbActors.ok
      ? `DB에서 ${dbActors.actors.length}명의 화자/페르소나를 불러왔습니다.`
      : dbActors.error || "",
  });

  // --- Check panel ---
  const draftField = el("textarea", { placeholder: "검사할 초안 텍스트를 입력하세요." });
  const speakerField = dbActors.ok
    ? el("select", {})
    : el("input", { placeholder: "화자 ID (선택)" });
  const personaField = dbActors.ok
    ? el("select", {})
    : el("input", { placeholder: "페르소나 ID (선택)" });
  if (dbActors.ok) {
    fillSelect(speakerField, dbActors.actors, "화자 선택");
    fillSelect(personaField, dbActors.actors.filter((a) => a.type === "persona"), "페르소나 선택");
    if (binding?.characterId) {
      const match = dbActors.actors.find(
        (a) => a.id === binding.characterId && a.type === "character"
      );
      if (match) speakerField.value = match.id;
    }
  }
  const listenersField = el("input", {
    placeholder: "청자 IDs (쉼표로 구분, 선택)",
  });
  const modeField = el("select", {}, [
    el("option", { value: "ic", text: "IC" }),
    el("option", { value: "ooc", text: "OOC" }),
    el("option", { value: "narrator", text: "내레이터" }),
    el("option", { value: "system", text: "시스템" }),
    el("option", { value: "debug", text: "디버그" }),
  ]);
  const contextFields = {
    speaker: speakerField,
    persona: personaField,
    listeners: listenersField,
    mode: modeField,
  };
  const checkResult = el("div", { className: "result" });
  panels.check.appendChild(actorHint);
  panels.check.appendChild(el("div", { className: "field" }, [el("label", { text: "초안" }), draftField]));
  panels.check.appendChild(
    el("div", { className: "field" }, [el("label", { text: "화자" }), speakerField])
  );
  panels.check.appendChild(
    el("div", { className: "field" }, [el("label", { text: "페르소나" }), personaField])
  );
  panels.check.appendChild(
    el("div", { className: "field" }, [el("label", { text: "청자" }), listenersField])
  );
  panels.check.appendChild(el("div", { className: "field" }, [el("label", { text: "모드" }), modeField]));
  panels.check.appendChild(
    el("button", {
      className: "btn btn-primary",
      text: "공개 검사",
      onclick: () => {
        const ctxCheck = buildContextFromFields(contextFields, binding);
        const result = checkDisclosure(
          draftField.value,
          ctxCheck,
          getBoundSecrets()
        );
        checkResult.className = `result ${result.safe ? "safe" : "unsafe"}`;
        const lines = [
          `결과: ${result.safe ? "안전" : "위험"} (${riskLabelKo(result.risk_level)})`,
        ];
        if (result.violations.length) {
          lines.push("", "위반 목록:");
          for (const v of result.violations) {
            lines.push("- " + formatViolation(v));
            if (v.suggested_rewrite) lines.push("  → " + v.suggested_rewrite);
          }
        }
        checkResult.textContent = lines.join("\n");
        if (!panels.check.contains(checkResult)) panels.check.appendChild(checkResult);
      },
    })
  );
  panels.check.appendChild(checkResult);

  // --- Guide panel ---
  const inputField = el("textarea", { placeholder: "유저 입력 또는 장면 키워드" });
  const guideResult = el("div", { className: "result" });
  panels.guide.appendChild(
    el("div", { className: "field" }, [el("label", { text: "입력" }), inputField])
  );
  panels.guide.appendChild(
    el("p", {
      className: "veil-sub",
      text: "검사 탭의 화자·페르소나·청자 설정을 가이드에도 사용합니다.",
    })
  );
  panels.guide.appendChild(
    el("button", {
      className: "btn btn-primary",
      text: "힌트 가져오기",
      onclick: () => {
        const result = makeGuidance(
          inputField.value,
          buildContextFromFields(contextFields, binding),
          getBoundSecrets()
        );
        const lines = [result.global_guidance, ""];
        if (!result.matched_secrets.length) {
          lines.push("매칭된 시크릿 없음");
        } else {
          for (const m of result.matched_secrets) {
            lines.push(`■ ${m.title} [${stageLabelKo(m.allowed_stage)}]`);
            for (const d of m.allowed_disclosures) lines.push("  - " + d);
            if (m.blocked_reveals?.length) {
              lines.push("  금지: " + m.blocked_reveals.join(", "));
            }
            lines.push("  " + m.rewrite_guidance);
            lines.push("");
          }
        }
        guideResult.textContent = lines.join("\n");
        if (!panels.guide.contains(guideResult)) panels.guide.appendChild(guideResult);
      },
    })
  );
  panels.guide.appendChild(guideResult);

  mountScanPanel(panels.scan, {
    Risuai,
    secrets,
    store,
    edition,
    resolveSidecarUrl,
    pluginOptions,
    binding,
    bindResult,
  });

  if (llmStore) {
    mountLlmSettingsPanel(panels.settings, {
      Risuai,
      llmStore,
      edition,
      pluginOptions,
      refreshOptions: refreshOptions
        ? async () => {
            pluginOptions = (await refreshOptions()) || pluginOptions;
            return pluginOptions;
          }
        : undefined,
      onSaved: async (opts) => {
        if (opts) pluginOptions = opts;
      },
    });
  } else {
    panels.settings.appendChild(
      el("p", {
        className: "veil-sub",
        text: "LLM 설정 저장소를 사용할 수 없습니다.",
      })
    );
  }

  if (Risuai && Risuai.showContainer) {
    await Risuai.showContainer("fullscreen");
  }
}
