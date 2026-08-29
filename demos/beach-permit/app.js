// Beach Permit — the declarative half of WebMCP. Where Trip Splitter registers
// functions with document.modelContext, this page registers nothing: it puts
// toolname/tooldescription on two <form>s and lets the browser synthesize each
// tool's input schema from the fields. useWebMCPForm() does the wiring and
// answers the agent through SubmitEvent.respondWith().
//
// The payoff is that one handler serves both audiences. A person filling the
// form in and clicking Submit runs exactly the code an agent's tool call runs,
// so the two can never drift apart.
//
// Full CDN URLs rather than bare specifiers: the local dev server (vite) would
// try to resolve bare imports from node_modules and fail. The import map in
// index.html maps "vue" to this exact URL so the vue-webmcp module, which
// imports "vue" internally, shares the same Vue instance.
import { createApp, ref } from "https://cdn.jsdelivr.net/npm/vue@3.5/dist/vue.esm-browser.prod.js";
import { WEBMCP_CONFIG, useWebMCPForm } from "https://cdn.jsdelivr.net/npm/vue-webmcp@0.3/dist/index.mjs";

const BEACHES = ["Flic en Flac", "Belle Mare", "Le Morne", "Pointe d'Esny", "Trou aux Biches"];
const GEAR = ["tent", "barbecue", "kayak", "generator"];

// Chrome's declarative API adds respondWith() to SubmitEvent. That is the thing
// this page actually needs, so it is the thing to feature-detect — the forms
// submit normally where it is missing.
const isSupported = typeof SubmitEvent !== "undefined" && "respondWith" in SubmitEvent.prototype;

const log = ref([]);
let logId = 0;

function textOf(response) {
  return (response?.content ?? [])
    .map((block) => block.text)
    .filter(Boolean)
    .join(" ");
}

// These handlers throw Errors rather than the bare strings Trip Splitter
// throws: an agent reads either one the same way, but this page also prints
// error.message next to the form, and a thrown string gets JSON-quoted on
// its way into an Error.

// A repeated field name (the gear checkboxes) arrives as an array, a single
// checked box as one string, and none at all as undefined.
function asList(value) {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map(String);
}

function count(value, label, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be a whole number between ${min} and ${max}; got "${value}".`);
  }
  return number;
}

const app = createApp({
  setup() {
    const permits = ref([]);
    const found = ref("");
    let issued = 0;

    // Fields come in as FormData entries, so every value is a string (or a File,
    // or an array where a name repeats) — the browser does not coerce for you.
    const {
      attrs: applyAttrs,
      isAgentActive: applyAgentActive,
      isSubmitting: applySubmitting,
      error: applyError,
    } = useWebMCPForm({
      name: "apply_for_permit",
      description: "Apply for a permit to camp overnight on a public beach",
      execute(fields, event) {
        const name = String(fields.name ?? "").trim();
        if (!name) throw new Error("A permit needs a name on it.");
        const beach = String(fields.beach ?? "");
        if (!BEACHES.includes(beach)) {
          throw new Error(`No such beach. Pick one of: ${BEACHES.join(", ")}.`);
        }
        const nights = count(fields.nights, "Nights", 1, 3);
        const people = count(fields.people, "People", 1, 12);

        const permit = {
          reference: `BP-${String(++issued).padStart(4, "0")}`,
          name,
          beach,
          nights,
          people,
          gear: asList(fields.gear),
          // True when an agent submitted through its tool rather than a person
          // clicking the button. The permit is the same either way.
          byAgent: event.agentInvoked === true,
        };
        permits.value.unshift(permit);
        if (event.target instanceof HTMLFormElement) event.target.reset();

        return `Permit ${permit.reference} granted to ${permit.name}: ${permit.beach}, ${permit.nights} night(s), ${permit.people} people.`;
      },
    });

    // toolautosubmit: a read-only lookup is safe for an agent to fill in and
    // submit in one go. The application above deliberately does not have it.
    const {
      attrs: checkAttrs,
      isSubmitting: checkSubmitting,
      error: checkError,
    } = useWebMCPForm({
      name: "check_permit",
      description: "Look up an already issued beach permit by its reference number",
      autosubmit: true,
      execute(fields) {
        const reference = String(fields.reference ?? "").trim().toUpperCase();
        const permit = permits.value.find((entry) => entry.reference === reference);
        if (!permit) {
          found.value = "";
          const known = permits.value.map((entry) => entry.reference).join(", ");
          throw new Error(`No permit ${reference || "(blank)"}. Issued so far: ${known || "none"}.`);
        }
        found.value = `${permit.reference} — ${permit.name}, ${permit.beach}, ${permit.nights} night(s), ${permit.people} people.`;
        return found.value;
      },
    });

    return {
      BEACHES,
      GEAR,
      isSupported,
      log,
      permits,
      found,
      applyAttrs,
      applyAgentActive,
      applySubmitting,
      applyError,
      checkAttrs,
      checkSubmitting,
      checkError,
    };
  },
});

// Form submissions reach the same app-level call hooks as an imperative tool,
// under the form's toolname — so the tape below records a person's click and an
// agent's tool call side by side, with no logging inside either handler.
app.provide(WEBMCP_CONFIG, {
  includeArgs: true,
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
