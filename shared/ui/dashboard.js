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
  listCharacterChatSessions,
  summarizeSecretSessions,
  removeSecretById,
  removeSecretsForBinding,
} from "../chat-binding.js";
import {
  countMigratableToCid,
  migrateIndexSecretsToCid,
} from "../chat-migration.js";
import {
  exportSessionSecrets,
  parseSessionImportPayload,
  mergeSessionImport,
} from "../storage/session-secrets.js";
import { attachSecretEditorToCard } from "./secret-editor.js";
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
    const migrated = migrateUnboundSecretsToBinding(secrets, binding);
    if (migrated > 0) await store.save(secrets);
  }

  let viewBindKey = binding?.bindKey || null;
  let characterRecord = null;
  if (binding && Risuai?.getDatabase) {
    try {
      const db = await Risuai.getDatabase(["characters"]);
      characterRecord = db?.characters?.[binding.charIndex] || null;
    } catch {
      characterRecord = null;
    }
  }

  function resolveViewBinding() {
    if (!binding || !viewBindKey) return binding;
    if (viewBindKey === binding.bindKey) return binding;
    const sessions = characterRecord
      ? listCharacterChatSessions(characterRecord, binding.charIndex)
      : [];
    const session = sessions.find((s) => s.bindKey === viewBindKey);
    if (session) {
      return {
        ...binding,
        bindKey: session.bindKey,
        bindKeyLegacy: session.bindKeyLegacy,
        matchKeys: session.chatSessionId
          ? [session.bindKey, session.bindKeyLegacy]
          : [session.bindKey],
        chatSessionId: session.chatSessionId || undefined,
        chatIndex: session.chatIndex,
        chatLabel: session.label,
        label: `${binding.characterName} · ${session.label}`,
      };
    }
    return { ...binding, bindKey: viewBindKey, matchKeys: [viewBindKey] };
  }

  function getBoundSecrets() {
    const view = resolveViewBinding();
    if (!bindResult.ok || !view?.bindKey) return [];
    return filterSecretsForBinding(secrets, view);
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
  const sessionBar = el("div", { className: "veil-session-bar" });
  if (binding && characterRecord) {
    const sessions = listCharacterChatSessions(
      characterRecord,
      binding.charIndex
    );
    const stored = summarizeSecretSessions(secrets, binding.characterId);
    const sessionSelect = el("select", { className: "veil-select" });
    for (const s of sessions) {
      const storedEntry = stored.find((x) => x.bindKey === s.bindKey);
      const count = storedEntry?.count || 0;
      const opt = el("option", {
        value: s.bindKey,
        text: `${s.label} (${count}개)${s.chatSessionId ? "" : " · 인덱스"}`,
      });
      if (s.bindKey === viewBindKey) opt.selected = true;
      sessionSelect.appendChild(opt);
    }
    sessionSelect.addEventListener("change", () => {
      viewBindKey = sessionSelect.value;
      renderSecretCards();
    });
    sessionBar.appendChild(
      el("label", { className: "veil-sub", text: "세션: " })
    );
    sessionBar.appendChild(sessionSelect);
    sessionBar.appendChild(
      el("button", {
        className: "btn btn-secondary",
        text: "이 세션 데이터 전체 삭제",
        onclick: async () => {
          const view = resolveViewBinding();
          const n = filterSecretsForBinding(secrets, view).length;
          if (
            !n ||
            !confirm(
              `이 채팅 세션의 VEIL 시크릿 ${n}개를 모두 삭제할까요? 되돌릴 수 없습니다.`
            )
          ) {
            return;
          }
          removeSecretsForBinding(secrets, view);
          await store.save(secrets);
          renderSecretCards();
        },
      })
    );
    const migratable = countMigratableToCid(
      secrets,
      characterRecord,
      binding.charIndex
    );
    if (migratable > 0) {
      sessionBar.appendChild(
        el("button", {
          className: "btn btn-secondary",
          text: `cid 키로 변환 (${migratable}개)`,
          onclick: async () => {
            if (
              !confirm(
                `인덱스 키(0:1 형식)로 묶인 시크릿 ${migratable}개를 Risu chat.id 기준 cid 키로 바꿀까요?`
              )
            ) {
              return;
            }
            const result = migrateIndexSecretsToCid(
              secrets,
              characterRecord,
              binding.charIndex
            );
            await store.save(secrets);
            alert(`변환 완료: ${result.migrated}개`);
            renderSecretCards();
          },
        })
      );
    }
    if (!binding.chatSessionId) {
      sessionBar.appendChild(
        el("p", {
          className: "veil-sub",
          text: "이 채팅에 Risu chat.id가 없습니다. 채팅을 한 번 저장·동기화하면 cid 키로 고정됩니다.",
        })
      );
    }
  }

  const secretsToolbar = el("div", { className: "toolbar" });
  const importInput = el("input", { type: "file", accept: "application/json,.json" });
  importInput.style.display = "none";
  const sessionImportInput = el("input", {
    type: "file",
    accept: "application/json,.json",
  });
  sessionImportInput.style.display = "none";

  secretsToolbar.appendChild(
    el("button", {
      className: "btn btn-secondary",
      text: "이 세션보내기",
      onclick: async () => {
        const view = resolveViewBinding();
        if (!view) {
          alert("채팅이 연결되지 않았습니다.");
          return;
        }
        const payload = exportSessionSecrets(secrets, view);
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        const safeLabel = (view.chatLabel || "session").replace(/[^\w.-]+/g, "_");
        const a = doc.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `veil-session-${safeLabel}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      },
    })
  );
  secretsToolbar.appendChild(
    el("button", {
      className: "btn btn-secondary",
      text: "이 세션 가져오기",
      onclick: () => {
        if (!resolveViewBinding()) {
          alert("채팅이 연결되지 않았습니다.");
          return;
        }
        sessionImportInput.click();
      },
    })
  );
  secretsToolbar.appendChild(
    el("button", {
      className: "btn btn-secondary",
      text: "전체 JSON 가져오기",
      onclick: () => importInput.click(),
    })
  );
  secretsToolbar.appendChild(
    el("button", {
      className: "btn btn-secondary",
      text: "전체 JSON보내기",
      onclick: async () => {
        const data = await store.exportSecrets();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const a = doc.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "veil-secrets-all.json";
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
  if (sessionBar.childNodes.length) panels.secrets.appendChild(sessionBar);
  panels.secrets.appendChild(secretsToolbar);
  panels.secrets.appendChild(importInput);
  panels.secrets.appendChild(sessionImportInput);

  sessionImportInput.addEventListener("change", async () => {
    const file = sessionImportInput.files && sessionImportInput.files[0];
    if (!file) return;
    const view = resolveViewBinding();
    if (!view) {
      alert("채팅이 연결되지 않았습니다.");
      sessionImportInput.value = "";
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      const parsedResult = parseSessionImportPayload(parsed);
      if (!parsedResult.ok) {
        alert(parsedResult.error || "가져오기 실패");
        return;
      }
      const replace = confirm(
        "확인 = 이 세션의 기존 시크릿을 지우고 가져온 목록으로 교체\n취소 = 같은 id는 덮어쓰고 나머지는 유지(병합)"
      );
      const result = mergeSessionImport({
        allSecrets: secrets,
        imported: parsedResult.secrets,
        viewBinding: view,
        mode: replace ? "replace" : "merge",
      });
      await store.save(secrets);
      renderSecretCards();
      alert(
        `세션 가져오기 완료 (제거 ${result.removed}, 추가 ${result.added}, 갱신 ${result.updated})`
      );
    } catch (e) {
      alert("JSON 파싱 오류: " + (e.message || e));
    }
    sessionImportInput.value = "";
  });

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
          text:
            secret.chatSessionId
              ? `cid:${String(secret.chatSessionId).slice(0, 8)}…`
              : secret.bindKey || `${secret.scopeType}:${secret.scopeId}`,
        })
      );
      card.appendChild(meta);

      const actions = el("div", { className: "row" });
      actions.appendChild(
        el("button", {
          className: "btn btn-secondary",
          text: "제목 수정",
          onclick: async () => {
            const next = prompt("시크릿 제목", secret.title || "");
            if (next == null || !next.trim()) return;
            secret.title = next.trim();
            secret.updatedAt = new Date().toISOString();
            await store.save(secrets);
            renderSecretCards();
          },
        })
      );
      actions.appendChild(
        el("button", {
          className: "btn btn-secondary",
          text: "삭제",
          onclick: async () => {
            if (!confirm(`「${maskTitle(secret)}」 시크릿을 삭제할까요?`)) return;
            removeSecretById(secrets, secret.id);
            await store.save(secrets);
            renderSecretCards();
          },
        })
      );
      card.appendChild(actions);
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

      attachSecretEditorToCard(card, doc, secret, {
        onSave: async (updated) => {
          const idx = secrets.findIndex((s) => s.id === secret.id);
          if (idx < 0) return;
          secrets[idx] = updated;
          await store.save(secrets);
          renderSecretCards();
        },
      });

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
