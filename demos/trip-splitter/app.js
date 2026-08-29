// Trip Splitter, built with Vue 3 and vue-webmcp (both loaded from the import
// map in index.html — no build step). Three things this demo shows that the
// vanilla demos cannot:
//
//   1. useWebMCPTools() registers the page-level group in one call, with one
//      shared onError, and reports on the group as a whole.
//   2. useWebMCPTool() inside <settle-panel> ties a tool to a component:
//      record-payment exists only while that panel is on screen.
//   3. app.provide(WEBMCP_CONFIG, …) feeds the tool activity tape. No execute()
//      logs itself — the app-level call hooks see every tool call, including
//      the settle panel's, so a tool is only ever its own domain logic.
//
// Full CDN URLs rather than bare specifiers: the local dev server (vite) would
// try to resolve bare imports from node_modules and fail. The import map in
// index.html maps "vue" to this exact URL so the vue-webmcp module, which
// imports "vue" internally, shares the same Vue instance.
import { computed, createApp, ref } from "https://cdn.jsdelivr.net/npm/vue@3.5/dist/vue.esm-browser.prod.js";
import {
  WEBMCP_CONFIG,
  useWebMCPTool,
  useWebMCPTools,
} from "https://cdn.jsdelivr.net/npm/vue-webmcp@0.3.3/dist/index.mjs";

// The tool activity tape lives outside the root component: the config below is
// provided before the app is created, and the root component reads it back out.
const log = ref([]);
let logId = 0;

// What the agent sees is an MCP result — { content: [{ type: "text", text }] } —
// whatever execute() returned before normalization.
function textOf(response) {
  return (response?.content ?? [])
    .map((block) => block.text)
    .filter(Boolean)
    .join(" ");
}

const SettlePanel = {
  props: {
    people: { type: Array, required: true },
  },
  emits: ["paid"],
  template: `
    <div class="board">
      <form @submit.prevent="submit">
        <select v-model="from" aria-label="Who pays">
          <option v-for="person in people" :key="person">{{ person }}</option>
        </select>
        pays
        <select v-model="to" aria-label="Who receives">
          <option v-for="person in people" :key="person">{{ person }}</option>
        </select>
        <input v-model.number="amount" type="number" min="1" placeholder="Rs" aria-label="Amount" />
        <button type="submit">Record</button>
      </form>
    </div>
  `,
  setup(props, { emit }) {
    const from = ref(props.people[0]);
    const to = ref(props.people[1] ?? props.people[0]);
    const amount = ref(null);

    function submit() {
      if (!amount.value || from.value === to.value) return;
      emit("paid", { from: from.value, to: to.value, amount: amount.value });
      amount.value = null;
    }

    // Registered on mount, unregistered on unmount: tick the checkbox off and
    // the agent stops being offered this tool.
    useWebMCPTool({
      name: "record-payment",
      title: "Record a payback",
      description: "Record that one person paid another back, settling part of their balance",
      inputSchema: {
        type: "object",
        properties: {
          from: { type: "string", description: "Who pays" },
          to: { type: "string", description: "Who receives" },
          amount: { type: "number", description: "Amount in rupees" },
        },
        required: ["from", "to", "amount"],
      },
      execute({ from: fromName, to: toName, amount: value }) {
        for (const name of [fromName, toName]) {
          if (!props.people.includes(name)) throw `No "${name}" on this trip.`;
        }
        emit("paid", { from: fromName, to: toName, amount: value });
        return `${fromName} paid ${toName} Rs ${value}.`;
      },
    });

    return { from, to, amount, submit };
  },
};

const app = createApp({
  components: { SettlePanel },
  setup() {
    const people = ref(["Sandeep", "Priya"]);
    const expenses = ref([{ payer: "Sandeep", amount: 2400, description: "beach house" }]);
    const payments = ref([]);
    const showSettle = ref(false);

    const newPerson = ref("");
    const expensePayer = ref("Sandeep");
    const expenseAmount = ref(null);
    const expenseDescription = ref("");

    const total = computed(() => expenses.value.reduce((sum, e) => sum + e.amount, 0));

    const balances = computed(() => {
      const share = total.value / people.value.length;
      return people.value.map((name) => {
        const paid = expenses.value
          .filter((e) => e.payer === name)
          .reduce((sum, e) => sum + e.amount, 0);
        const settled = payments.value.reduce(
          (sum, p) => sum + (p.from === name ? p.amount : 0) - (p.to === name ? p.amount : 0),
          0,
        );
        return { name, net: Math.round(paid - share + settled) };
      });
    });

    function balanceLine(balance) {
      if (balance.net > 0) return `gets back Rs ${balance.net}`;
      if (balance.net < 0) return `owes Rs ${-balance.net}`;
      return "settled";
    }

    function recordPayment(payment) {
      payments.value.push(payment);
    }

    function submitPerson() {
      const name = newPerson.value.trim();
      if (!name || people.value.includes(name)) return;
      people.value.push(name);
      newPerson.value = "";
    }

    function submitExpense() {
      if (!expenseAmount.value) return;
      expenses.value.push({
        payer: expensePayer.value,
        amount: expenseAmount.value,
        description: expenseDescription.value.trim() || "misc",
      });
      expenseAmount.value = null;
      expenseDescription.value = "";
    }

    // One call for the whole page-level group. Each definition still goes
    // through useWebMCPTool, so per-tool options win over the shared ones and
    // one tool failing to register leaves the others up. In TypeScript these
    // would live in their own module, wrapped in defineWebMCPTool() to keep
    // execute()'s argument types.
    const { isSupported, byName } = useWebMCPTools(
      [
        {
          name: "add-person",
          title: "Add someone to the trip",
          description: "Add a person to the trip; every expense is split equally among everyone",
          inputSchema: {
            type: "object",
            properties: { name: { type: "string", description: "The person's name" } },
            required: ["name"],
          },
          execute({ name }) {
            if (people.value.includes(name)) throw `"${name}" is already on the trip.`;
            people.value.push(name);
            return `${name} joined the trip (${people.value.length} people now).`;
          },
        },
        {
          name: "add-expense",
          title: "Log an expense",
          description: "Record an expense someone paid for the group",
          inputSchema: {
            type: "object",
            properties: {
              payer: { type: "string", description: "Who paid; must already be on the trip" },
              amount: { type: "number", description: "Amount in rupees" },
              description: { type: "string", description: "What the expense was for" },
            },
            required: ["payer", "amount"],
          },
          execute({ payer, amount, description = "misc" }) {
            if (!people.value.includes(payer)) {
              throw `No "${payer}" on this trip. People: ${people.value.join(", ")}.`;
            }
            expenses.value.push({ payer, amount, description });
            return `Rs ${amount} from ${payer} for ${description}.`;
          },
        },
        {
          name: "get-balances",
          title: "Who owes whom",
          description: "List each person's balance: who owes money and who gets money back",
          annotations: { readOnlyHint: true },
          execute() {
            // Reads the computed live at call time — no stale closure.
            return balances.value.map((b) => `${b.name} ${balanceLine(b)}`).join("\n");
          },
        },
      ],
      {
        onError: (error, name) => console.warn(`vue-webmcp: "${name}" did not register`, error),
      },
    );

    const registeredCount = computed(
      () =>
        Object.values(byName).filter((tool) => tool.isRegistered.value).length +
        (showSettle.value ? 1 : 0),
    );

    return {
      people,
      expenses,
      log,
      showSettle,
      newPerson,
      expensePayer,
      expenseAmount,
      expenseDescription,
      total,
      balances,
      balanceLine,
      recordPayment,
      submitPerson,
      submitExpense,
      isSupported,
      registeredCount,
    };
  },
});

// App-level call hooks reach every tool in the app, including the one the
// settle panel registers, so the tape below is filled without a single logging
// line inside a tool. includeArgs is off by default because arguments often
// carry personal data — a demo whose whole point is showing the call is the
// case for turning it on. budgets: "warn" complains in the console when a
// name, description or result outgrows Chrome's character budgets.
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
