import { VEIL_BUTTON_ICON } from "./icons.js";
import { openDashboard } from "./dashboard.js";

export async function registerVeilUI(Risuai, ctx) {
  if (!Risuai || !Risuai.registerButton) {
    console.log("[VEIL] registerButton is not available.");
    return { uiParts: [] };
  }

  const uiParts = [];
  const open = async () => {
    try {
      await openDashboard(document, { Risuai, ...ctx });
    } catch (error) {
      const msg =
        error?.message ||
        String(error) ||
        "VEIL 대시보드를 열 수 없습니다.";
      console.log("[VEIL] Dashboard error:", msg);
      if (typeof alert === "function") {
        alert(
          "VEIL을 열 수 없습니다.\n\n" +
            "봇(캐릭터)과 채팅을 선택한 뒤 다시 시도해 주세요.\n\n" +
            (msg.includes("chatPage") || msg.includes("characters")
              ? "채팅이 선택되지 않은 상태에서 VEIL을 연 것 같습니다."
              : msg)
        );
      }
      if (Risuai?.hideContainer) {
        try {
          await Risuai.hideContainer();
        } catch {
          /* ignore */
        }
      }
    }
  };

  const buttonConfig = {
    name: "VEIL",
    icon: VEIL_BUTTON_ICON,
    iconType: "html",
  };

  for (const location of ["hamburger", "chat"]) {
    const part = await Risuai.registerButton(
      { ...buttonConfig, location },
      open
    );
    if (part?.id) uiParts.push(part.id);
  }

  if (Risuai.registerPluginUnload) {
    Risuai.registerPluginUnload(async () => {
      for (const id of uiParts) {
        try {
          await Risuai.unregisterUIPart(id);
        } catch {
          /* ignore */
        }
      }
    });
  }

  console.log("[VEIL] GUI buttons registered (hamburger + chat).");
  return { uiParts };
}
