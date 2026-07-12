// Shared helper for all demos: registers tools with WebMCP when available,
// shows a status badge, and logs every tool call so you can see what the
// agent did (or drive the same functions by hand when no agent is around).

export function textResult(text) {
  return { content: [{ type: "text", text }] };
}

export async function setupWebMCP({ tools = [] } = {}) {
  const badge = document.createElement("div");
  badge.className = "webmcp-badge";

  const panel = document.createElement("section");
  panel.className = "webmcp-log";
  panel.innerHTML = "<h2>Tool activity</h2><ol></ol>";

  const main = document.querySelector("main") ?? document.body;
  main.append(panel);
  document.querySelector("header")?.append(badge);

  const list = panel.querySelector("ol");
  const logCall = (tool, args, result) => {
    const li = document.createElement("li");
    const argText = args && Object.keys(args).length ? JSON.stringify(args) : "";
    li.innerHTML = `<code>${tool}</code> <span class="args">${argText}</span> <span class="result">${result ?? ""}</span>`;
    list.prepend(li);
  };

  if (!("modelContext" in document)) {
    badge.textContent = "no agent detected — works by hand too";
    badge.dataset.state = "off";
    return { active: false, logCall };
  }

  for (const tool of tools) {
    try {
      await document.modelContext.registerTool({
        ...tool,
        async execute(args) {
          const result = await tool.execute(args);
          const text = result?.content?.map((c) => c.text).join(" ") ?? "done";
          logCall(tool.name, args, text);
          return result;
        },
      });
    } catch (err) {
      console.warn(`Could not register tool ${tool.name}`, err);
    }
  }

  badge.textContent = `WebMCP active — ${tools.length} tools registered`;
  badge.dataset.state = "on";
  return { active: true, logCall };
}
