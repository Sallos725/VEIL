# MCP (deprecated)

VEIL no longer registers tools via `Risuai.registerMCP()`.

RisuAI exposes model-callable MCP primarily through **Risu modules**, not plugin-registered tools. VEIL operations run through the **dashboard GUI** and (Full edition) the **HTTP sidecar**.

Use [`../veil-service.js`](../veil-service.js) for programmatic calls from the plugin UI.
