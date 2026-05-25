import { DASHBOARD_CSS } from "./styles.js";
import {
  stageLabelKo,
  sourceLabelKo,
  formatViolation,
  riskLabelKo,
} from "./labels.js";
import {
  makeGuidance,
  getAllowedDisclosures,
  advanceRevealStage,
} from "../core.js";
import {
  checkDisclosureLite,
  checkDisclosureFull,
  redactDraft,
} from "../veil-service.js";
import { getPromptSnippet } from "./prompt-snippet.js";
import { isRisuLlmProvider } from "../llm/providers.js";
import { VEIL_RELEASE_TAG } from "../plugin-meta.js";
import { VEIL_STAGE_ORDER } from "../revealStages.js";
import { loadDbActors, fillSelect, buildContextFromFields } from "./db-actors.js";
import { mountScanPanel } from "./scan-panel.js";
import { mountLlmSettingsPanel } from "./llm-settings-panel.js";
import { mountRpLinkPanel } from "./rp-link-panel.js";
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
import { VEIL_DISPLAY_VERSION } from "../plugin-meta.js";

const DEFAULT_SIDECAR_URL = "http://127.0.0.1:6010";

async function persistSidecarUrl(llmStore, url, refreshOptions) {
  if (!llmStore) return null;
  const current = await llmStore.load();
  await llmStore.save({
    ...current,
    sidecarUrl: String(url || "").trim(),
  });
  return refreshOptions ? refreshOptions() : null;
}

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
    rpSettingsStore,
    replacerStatus,
  } = ctx;
  let pluginOptions = initialPluginOptions || {};
  let activeTab = "secrets";
  let status = store.getStatus();

  if (edition === "full" && store.refreshHealth) {
    await store.refreshHealth();
    status = store.getStatus();
  }

  const bindResult = await resolveChatBindingSafe(Risuai);
  const binding = bindResult.binding;
  const fullBlocked =
    edition === "full" && (!status.sidecarOnline || status.readOnly);

  function guardWrite() {
    if (fullBlocked) {
      alert(
        status.error ||
          "VEIL Full은 sidecar가 필요합니다. sidecar를 실행한 뒤 다시 여세요."
      );
      return false;
    }
    return true;
  }

  if (binding && !fullBlocked) {
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
      text:
        edition === "full"
          ? "Full · sidecar 필수 — 대시보드 GUI (MCP 미사용)"
          : "Lite · 로컬 저장 — 대시보드 GUI (MCP 미사용)",
    }),
  ]);
  const chips = el("div", { className: "veil-chips" });
  chips.appendChild(
    el("span", {
      className: "chip chip-version",
      text: VEIL_DISPLAY_VERSION,
      title: "VEIL 플러그인 버전",
    })
  );
  chips.appendChild(
    el("span", {
      className: "chip",
      text: edition === "full" ? "Full · sidecar" : "Lite · local",
    })
  );
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

  if (fullBlocked) {
    const gate = el("div", { className: "card veil-sidecar-gate" });
    gate.appendChild(el("h3", { text: "Sidecar 연결 필요" }));
    gate.appendChild(
      el("p", {
        text: "VEIL Full은 HTTP sidecar 없이 동작하지 않습니다. 아래 순서로 sidecar를 실행한 뒤 VEIL을 다시 여세요.",
      })
    );
    gate.appendChild(
      el("pre", {
        className: "veil-code",
        text: `Release: veil-full-${VEIL_RELEASE_TAG}.js + veil-sidecar-${VEIL_RELEASE_TAG}.zip
ZIP: ./full/sidecar/scripts/start-node.sh
Docker: docker pull ghcr.io/sallos725/veil-sidecar:${VEIL_RELEASE_TAG}
  cd full && docker compose up -d
curl http://127.0.0.1:6010/health`,
      })
    );
    gate.appendChild(
      el("p", {
        className: "veil-sub",
        text: "플러그인 설정 메뉴에서 URL을 넣을 필요 없습니다. sidecar를 띄운 뒤 아래 URL을 확인하고 연결하세요.",
      })
    );
    const sidecarUrlInput = el("input", {
      className: "veil-input",
      placeholder: DEFAULT_SIDECAR_URL,
      value: pluginOptions.sidecarUrl || DEFAULT_SIDECAR_URL,
    });
    gate.appendChild(
      el("div", { className: "field" }, [
        el("label", { text: "Sidecar URL" }),
        sidecarUrlInput,
      ])
    );
    gate.appendChild(
      el("p", {
        className: "veil-sub",
        text: "플러그인만으로 RP하는 Lite가 필요하면 veil-lite.js를 사용하세요.",
      })
    );
    gate.appendChild(
      el("button", {
        className: "btn btn-primary",
        text: "URL 저장 후 연결 확인",
        onclick: async () => {
          const url = sidecarUrlInput.value.trim() || DEFAULT_SIDECAR_URL;
          if (llmStore) {
            const next = await persistSidecarUrl(
              llmStore,
              url,
              refreshOptions
            );
            if (next) pluginOptions = next;
          }
          if (store.refreshHealth) {
            await store.refreshHealth();
            status = store.getStatus();
            if (status.sidecarOnline) {
              await store.load();
              location.reload();
            } else {
              alert(
                `sidecar에 연결되지 않았습니다.\n\nURL: ${url}\n\nsidecar가 실행 중인지, 방화벽·포트(6010)를 확인하세요.`
              );
            }
          }
        },
      })
    );
    root.appendChild(gate);
  }

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
  const tabNames = fullBlocked
    ? [
        ["secrets", "시크릿"],
        ["help", "안내"],
      ]
    : edition === "full"
      ? [
          ["secrets", "시크릿"],
          ["check", "검사"],
          ["redact", "수정"],
          ["guide", "가이드"],
          ["scan", "스캔"],
          ["settings", "LLM 설정"],
          ["help", "안내"],
        ]
      : [
          ["secrets", "시크릿"],
          ["check", "검사"],
          ["guide", "가이드"],
          ["scan", "스캔"],
          ["settings", "LLM 설정"],
          ["help", "안내"],
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
          if (!guardWrite()) return;
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
            if (!guardWrite()) return;
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
  if (!fullBlocked) {
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
  }
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
  if (!fullBlocked) {
  secretsToolbar.appendChild(
    el("button", {
      className: "btn btn-primary",
      text: "저장",
      onclick: async () => {
        if (!guardWrite()) return;
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
  }
  if (fullBlocked) {
    secretsToolbar.appendChild(
      el("p", {
        className: "veil-sub",
        text: "읽기 전용 — sidecar 연결 후 편집·저장이 가능합니다.",
      })
    );
  }
  if (sessionBar.childNodes.length) panels.secrets.appendChild(sessionBar);
  panels.secrets.appendChild(secretsToolbar);
  panels.secrets.appendChild(importInput);
  panels.secrets.appendChild(sessionImportInput);

  sessionImportInput.addEventListener("change", async () => {
    if (!guardWrite()) return;
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
    if (!guardWrite()) return;
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
              if (!guardWrite()) return;
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
          if (!guardWrite()) return;
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

  // --- Check panel ---
  if (!fullBlocked && panels.check) {
  const draftField = el("textarea", { placeholder: "검사할 초안 텍스트를 입력하세요." });
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
        text: (() => {
          if (
            pluginOptions.llmConfigured &&
            isRisuLlmProvider(pluginOptions.llmRaw?.providerId)
          ) {
            return "공개 검사 (Risu LLM)";
          }
          if (pluginOptions.llmConfigured) {
            return edition === "full"
              ? "공개 검사 (LLM → sidecar)"
              : "공개 검사 (LLM 보조)";
          }
          return edition === "full" ? "공개 검사 (sidecar)" : "공개 검사";
        })(),
        onclick: async () => {
          const ctxCheck = buildContextFromFields(contextFields, binding);
          ctxCheck.draft_text = draftField.value;
          checkResult.textContent = "검사 중…";
          checkResult.className = "result";
          let result;
          try {
            const llmRaw = pluginOptions.llmRaw;
            if (edition === "full" && resolveSidecarUrl) {
              const url = await resolveSidecarUrl(ctxCheck);
              result = await checkDisclosureFull(
                Risuai,
                secrets,
                ctxCheck,
                url,
                llmRaw
              );
            } else {
              result = await checkDisclosureLite(
                Risuai,
                secrets,
                ctxCheck,
                resolveSidecarUrl,
                llmRaw
              );
            }
          } catch (e) {
            checkResult.textContent = "검사 오류: " + (e?.message || e);
            return;
          }
          checkResult.className = `result ${result.safe ? "safe" : "unsafe"}`;
          const lines = [
            `결과: ${result.safe ? "안전" : "위험"} (${riskLabelKo(result.risk_level)})`,
          ];
          if (result.risu_assisted) lines.push("(Risu 메인/보조 LLM 보조)");
          if (result.plugin_llm_assisted) lines.push("(외부 LLM semantic 보조)");
          if (result.sidecar_assisted) lines.push("(sidecar semantic 보조)");
          if (result.violations?.length) {
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
  }

  // --- Guide panel ---
  if (!fullBlocked && panels.guide) {
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
  }

  if (!fullBlocked && edition === "full" && panels.redact) {
    const redactDraftField = el("textarea", {
      placeholder: "수정할 초안 텍스트",
    });
    const redactStage = el("select", {}, []);
    for (const stage of VEIL_STAGE_ORDER) {
      redactStage.appendChild(
        el("option", { value: stage, text: stageLabelKo(stage) })
      );
    }
    redactStage.value = "hint";
    const redactResult = el("div", { className: "result" });
    panels.redact.appendChild(
      el("p", {
        className: "veil-sub",
        text: "허용 단계에 맞게 초안을 줄이거나 바꿉니다 (Risu/외부 LLM 또는 sidecar /rewrite).",
      })
    );
    panels.redact.appendChild(
      el("div", { className: "field" }, [el("label", { text: "초안" }), redactDraftField])
    );
    panels.redact.appendChild(
      el("div", { className: "field" }, [el("label", { text: "목표 단계" }), redactStage])
    );
    panels.redact.appendChild(
      el("button", {
        className: "btn btn-primary",
        text: "수정 가이드 생성",
        onclick: async () => {
          const ctxRedact = buildContextFromFields(contextFields, binding);
          ctxRedact.draft_text = redactDraftField.value;
          ctxRedact.target_stage = redactStage.value;
          redactResult.textContent = "처리 중…";
          try {
            const url = resolveSidecarUrl
              ? await resolveSidecarUrl(ctxRedact)
              : "";
            const result = await redactDraft(
              Risuai,
              secrets,
              ctxRedact,
              url,
              { useSidecar: true, llmRaw: pluginOptions.llmRaw }
            );
            const lines = [
              result.redacted_text || "(텍스트 없음)",
              "",
              result.explanation || "",
              `잔여 위험: ${riskLabelKo(result.remaining_risk || "none")}`,
            ];
            if (result.risu_assisted) lines.unshift("(Risu LLM rewrite 적용)");
            if (result.plugin_llm_assisted) lines.unshift("(외부 LLM rewrite 적용)");
            if (result.sidecar_assisted) lines.unshift("(sidecar rewrite 적용)");
            redactResult.textContent = lines.join("\n");
            redactResult.className = "result safe";
          } catch (e) {
            redactResult.textContent = "오류: " + (e?.message || e);
          }
          if (!panels.redact.contains(redactResult)) {
            panels.redact.appendChild(redactResult);
          }
        },
      })
    );
    panels.redact.appendChild(redactResult);
  } else if (panels.redact) {
    panels.redact.appendChild(
      el("p", {
        className: "veil-sub",
        text:
          edition === "full"
            ? "sidecar 연결 후 사용할 수 있습니다."
            : "VEIL Lite에는 수정 탭이 없습니다. Full + sidecar를 사용하세요.",
      })
    );
  }

  if (rpSettingsStore && panels.help) {
    mountRpLinkPanel(panels.help, {
      Risuai,
      rpSettingsStore,
      replacerStatus,
    });
  }

  const snippetArea = el("textarea", {
    className: "veil-textarea",
    rows: "8",
    value: getPromptSnippet("ko"),
  });
  snippetArea.readOnly = true;
  panels.help.appendChild(
    el("p", {
      className: "veil-sub",
      text: "캐릭터 카드·시스템 프롬프트에 붙여 넣으세요. VEIL은 MCP 도구가 아니라 대시보드 GUI로 사용합니다.",
    })
  );
  panels.help.appendChild(snippetArea);
  panels.help.appendChild(
    el("button", {
      className: "btn btn-primary",
      text: "스니펫 복사",
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(snippetArea.value);
          alert("복사되었습니다.");
        } catch {
          snippetArea.select();
          doc.execCommand("copy");
          alert("복사되었습니다 (수동).");
        }
      },
    })
  );

  if (!fullBlocked && panels.scan) {
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
  }

  if (llmStore && !fullBlocked && panels.settings) {
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
  } else if (panels.settings) {
    panels.settings.appendChild(
      el("p", {
        className: "veil-sub",
        text: fullBlocked
          ? "sidecar 연결 후 LLM 설정을 사용할 수 있습니다."
          : "LLM 설정 저장소를 사용할 수 없습니다.",
      })
    );
  }

  if (Risuai && Risuai.showContainer) {
    await Risuai.showContainer("fullscreen");
  }
}
