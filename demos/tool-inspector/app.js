// Tool Inspector — the consumer side of WebMCP. Every other demo answers an
// agent; this one *is* the agent. useRegisteredTools() wraps the other half of
// document.modelContext — getTools() to discover, executeTool() to call, and
// the toolchange event to stay current — so a page can drive tools rather than
// only offer them. That is what an in-page assistant, a dev panel, or an
// iframe-hosted agent reading a partner page is built on.
//
// So there is always something to inspect, the page also registers a small
// notebook of its own. Both halves talk to the same document, so running a tool
// from the panel below goes out through executeTool() and comes back in through
// the notebook's execute() — and the tape at the bottom, fed by the app-level
// call hooks, records the trip.
//
// Full CDN URLs rather than bare specifiers: the local dev server (vite) would
// try to resolve bare imports from node_modules and fail. The import map in
// index.html maps "vue" to this exact URL so the vue-webmcp module, which
// imports "vue" internally, shares the same Vue instance.
import { computed, createApp, ref, watch } from "https://cdn.jsdelivr.net/npm/vue@3.5/dist/vue.esm-browser.prod.js";
import {
  WEBMCP_CONFIG,
  useRegisteredTools,
  useWebMCPTools,
} from "https://cdn.jsdelivr.net/npm/vue-webmcp@0.3/dist/index.mjs";

const log = ref([]);
let logId = 0;

function textOf(response) {
  return (response?.content ?? [])
    .map((block) => block.text)
    .filter(Boolean)
    .join(" ");
}

// A starting point for the args editor, built from whatever the browser handed
// back as the tool's input schema.
function skeleton(schema) {
  const properties = schema?.properties;
  if (!properties) return "{}";
  const draft = {};
  for (const [key, definition] of Object.entries(properties)) {
    draft[key] =
      definition.enum?.[0] ??
      (definition.type === "number" || definition.type === "integer"
        ? 0
        : definition.type === "boolean"
          ? false
          : definition.type === "array"
            ? []
            : "");
  }
  return JSON.stringify(draft, null, 2);
}

const app = createApp({
  setup() {
    // ---- the side being inspected -------------------------------------
    const notes = ref(["buy dholl puri", "call the boat guy"]);
    const deletable = ref(false);

    useWebMCPTools([
      {
        name: "add-note",
        title: "Add a note",
        description: "Add a note to the notebook on this page",
        inputSchema: {
          type: "object",
          properties: { text: { type: "string", description: "What the note says" } },
          required: ["text"],
        },
        execute({ text }) {
          const note = String(text ?? "").trim();
          if (!note) throw "A note needs some text.";
          notes.value.push(note);
          return `Added "${note}" (${notes.value.length} notes now).`;
        },
      },
      {
        name: "list-notes",
        title: "Read the notebook",
        description: "List every note currently in the notebook",
        annotations: { readOnlyHint: true },
        execute() {
          if (!notes.value.length) return "The notebook is empty.";
          return notes.value.map((note, i) => `${i}. ${note}`).join("\n");
        },
      },
      {
        name: "clear-notes",
        title: "Empty the notebook",
        description: "Remove every note from the notebook",
        execute() {
          const count = notes.value.length;
          notes.value = [];
          return `Cleared ${count} note(s).`;
        },
      },
      {
        // enabled takes a ref: this one is registered only while the box is
        // ticked. Tick it and watch the panel below pick it up — that is the
        // toolchange event refreshing useRegisteredTools() with no polling.
        name: "delete-note",
        title: "Delete one note",
        description: "Delete a single note by its position in the list, counting from 0",
        enabled: deletable,
        inputSchema: {
          type: "object",
          properties: {
            index: { type: "number", description: "Position of the note, counting from 0" },
          },
          required: ["index"],
        },
        execute({ index }) {
          const at = Number(index);
          if (!Number.isInteger(at) || at < 0 || at >= notes.value.length) {
            throw `No note at ${index}; the notebook holds ${notes.value.length}.`;
          }
          const [gone] = notes.value.splice(at, 1);
          return `Deleted "${gone}".`;
        },
      },
    ]);

    // ---- the side doing the inspecting --------------------------------
    const { isSupported, tools, error, refresh, execute: runTool } = useRegisteredTools();

    const selectedName = ref("");
    const selected = computed(
      () => tools.value.find((tool) => tool.name === selectedName.value) ?? null,
    );

    const argsText = ref("{}");
    const running = ref(false);
    const result = ref("");
    const resultIsError = ref(false);
    const failure = ref("");

    // Picking a different tool starts a fresh call: new args, no stale result.
    watch(selectedName, () => {
      argsText.value = skeleton(selected.value?.inputSchema);
      result.value = "";
      resultIsError.value = false;
      failure.value = "";
    });

    // A tool that disappears while selected (the box gets unticked) should not
    // leave its name sitting in the panel.
    watch(tools, () => {
      if (selectedName.value && !selected.value) selectedName.value = "";
    });

    async function run() {
      const tool = selected.value;
      if (!tool || running.value) return;
      running.value = true;
      result.value = "";
      resultIsError.value = false;
      failure.value = "";
      try {
        const text = argsText.value.trim();
        const args = text ? JSON.parse(text) : {};
        const out = await runTool(tool, args);
        // A tool that fails answers with an isError result; only the browser or
        // a missing tool rejects. Worth showing apart, since both land here.
        resultIsError.value = Boolean(out && typeof out === "object" && out.isError);
        result.value = typeof out === "string" ? out : JSON.stringify(out, null, 2);
      } catch (err) {
        // A bad JSON payload never reaches the browser; a tool that rejects
        // comes back as the browser's DOMException.
        failure.value = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      } finally {
        running.value = false;
      }
    }

    function pretty(value) {
      return value === undefined ? "" : JSON.stringify(value, null, 2);
    }

    return {
      notes,
      deletable,
      isSupported,
      tools,
      error,
      refresh,
      selectedName,
      selected,
      argsText,
      running,
      result,
      resultIsError,
      failure,
      run,
      pretty,
      log,
    };
  },
});

// The notebook's tools report through these, so the tape shows the far end of
// every call the panel makes.
app.provide(WEBMCP_CONFIG, {
  includeArgs: true,
  budgets: "warn",
  onToolResult({ name, ok, ms, response, args }) {
    log.value.unshift({
      id: ++logId,
      tool: name,
      args: args && Object.keys(args).length ? JSON.stringify(args) : "",
      result: `${ok ? "" : "error: "}${textOf(response)}`,
      ms: `${Math.round(ms)} ms`,
    });
  },
});

app.mount("#app");
