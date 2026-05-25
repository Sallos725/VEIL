export const DASHBOARD_CSS = `
:root {
  color-scheme: dark;
  font-family: "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #12121f;
  color: #e8e8f0;
  min-height: 100vh;
}
.veil-app {
  max-width: 960px;
  margin: 0 auto;
  padding: 16px;
}
.veil-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.veil-title { font-size: 1.25rem; font-weight: 700; margin: 0; }
.veil-sub { font-size: 0.85rem; color: #9aa0b8; margin: 4px 0 0; }
.veil-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.chip {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  background: #2a2a44;
}
.chip.ok { background: #1f4d3a; color: #9ef0c5; }
.chip.warn { background: #4d3a1f; color: #f0d69e; }
.chip.off { background: #3a2a2a; color: #f0a0a0; }
.veil-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 1px solid #2e2e48;
  padding-bottom: 8px;
}
.veil-tab {
  background: transparent;
  border: none;
  color: #9aa0b8;
  padding: 10px 14px;
  min-height: 44px;
  cursor: pointer;
  border-radius: 8px;
  font-size: 0.95rem;
}
.veil-tab.active {
  color: #fff;
  background: #2d2d50;
}
.veil-panel { display: none; }
.veil-panel.active { display: block; }
.btn {
  min-height: 44px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-primary { background: #5b6cff; color: #fff; }
.btn-secondary { background: #2a2a44; color: #e8e8f0; }
.btn-danger { background: #5c2a2a; color: #ffc9c9; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.card {
  background: #1a1a2e;
  border: 1px solid #2e2e48;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
}
.card h3 { margin: 0 0 8px; font-size: 1rem; }
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  background: #3a3a60;
  margin-right: 6px;
}
.field { margin-bottom: 12px; }
.field label {
  display: block;
  font-size: 0.8rem;
  color: #9aa0b8;
  margin-bottom: 6px;
}
input:not([type="checkbox"]):not([type="radio"]),
textarea,
select {
  width: 100%;
  max-width: 100%;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #3a3a60;
  background: #0f0f1a;
  color: #e8e8f0;
  font-size: 0.9rem;
  min-height: 44px;
}
textarea { min-height: 120px; resize: vertical; }
.veil-app input[type="checkbox"] {
  width: 16px;
  height: 16px;
  min-height: 16px;
  max-width: 16px;
  margin: 2px 0 0;
  padding: 0;
  flex: 0 0 16px;
  accent-color: #5b6cff;
}
.veil-check-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.veil-check-row .veil-check-label {
  flex: 1;
  min-width: 0;
  font-size: 0.88rem;
  line-height: 1.4;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.secret-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0;
}
.veil-bind-banner {
  background: #1f2a44;
  border: 1px solid #3a4a70;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 12px;
  font-size: 0.88rem;
  line-height: 1.45;
}
.veil-bind-banner.warn {
  background: #3a2a1f;
  border-color: #6a5030;
  color: #f0d69e;
}
.veil-session-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 10px 12px;
  background: #1a2030;
  border-radius: 8px;
  border: 1px solid #2e3a55;
}
.veil-session-bar .veil-select {
  min-width: 200px;
  max-width: 100%;
  flex: 1;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid #3a4a70;
  background: #12182a;
  color: #e8eaf0;
}
.veil-label {
  display: block;
  font-size: 0.78rem;
  color: #9aa3c4;
  margin: 8px 0 4px;
}
.veil-input,
.veil-select,
.veil-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #3a4a70;
  background: #12182a;
  color: #e8eaf0;
  font-size: 0.88rem;
}
.veil-textarea {
  min-height: 64px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.4;
}
.veil-textarea-sm {
  min-height: 48px;
}
.veil-secret-editor {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #2e3a55;
}
.veil-secret-details summary {
  cursor: pointer;
  font-size: 0.88rem;
  color: #b8c4e8;
}
.veil-app ol {
  margin: 8px 0 0;
  padding-left: 1.25rem;
  font-size: 0.88rem;
  color: #b8bdd6;
  line-height: 1.5;
}
.veil-app ol li { margin-bottom: 4px; }
.veil-input-ok {
  border-color: #3ecf8e !important;
  box-shadow: 0 0 0 1px rgba(62, 207, 142, 0.35);
}
.veil-vertex-block textarea {
  min-height: 140px;
  font-family: ui-monospace, monospace;
  font-size: 0.8rem;
}
.veil-tabs {
  flex-wrap: wrap;
}
.card .row {
  align-items: center;
}
.card p, .card summary {
  margin: 6px 0;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.result {
  background: #0f0f1a;
  border-radius: 8px;
  padding: 12px;
  font-size: 0.85rem;
  white-space: pre-wrap;
  margin-top: 12px;
}
.result.safe { border-left: 4px solid #3ecf8e; }
.result.unsafe { border-left: 4px solid #ff6b6b; }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.details {
  margin-top: 10px;
  font-size: 0.85rem;
  color: #b8bdd6;
}
.toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
`;
