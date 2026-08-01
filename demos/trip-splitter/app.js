// Trip Splitter, built with Vue 3 and the vue-webmcp composable (both loaded
// from the import map in index.html — no build step). Unlike the other demos,
// which register tools through shared/webmcp.js, this one uses
// useWebMCPTool(): registration follows component lifecycle, and execute
// reads the live reactive state.
// Full CDN URLs rather than bare specifiers: the local dev server (vite)
// would try to resolve bare imports from node_modules and fail. The import
// map in index.html maps "vue" to this exact URL so the vue-webmcp module,
// which imports "vue" internally, shares the same Vue instance.
import { computed, createApp, ref } from "https://cdn.jsdelivr.net/npm/vue@3.5/dist/vue.esm-browser.prod.js";
import { useWebMCPTool } from "https://cdn.jsdelivr.net/npm/vue-webmcp@0.1/dist/index.mjs";

const SettlePanel = {
  props: {
    people: { type: Array, required: true },
    logCall: { type: Function, required: true },
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

    useWebMCPTool({
      name: "record-payment",
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
        const message = `${fromName} paid ${toName} Rs ${value}.`;
        props.logCall("record-payment", { from: fromName, to: toName, amount: value }, message);
        return message;
      },
    });

    return { from, to, amount, submit };
  },
};

createApp({
  components: { SettlePanel },
  setup() {
    const people = ref(["Sandeep", "Priya"]);
    const expenses = ref([{ payer: "Sandeep", amount: 2400, description: "beach house" }]);
    const payments = ref([]);
    const log = ref([]);
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

    function logCall(tool, args, result) {
      log.value.unshift({ tool, args: JSON.stringify(args), result });
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

    const tools = [
      useWebMCPTool({
        name: "add-person",
        description: "Add a person to the trip; every expense is split equally among everyone",
        inputSchema: {
          type: "object",
          properties: { name: { type: "string", description: "The person's name" } },
          required: ["name"],
        },
        execute({ name }) {
          if (people.value.includes(name)) throw `"${name}" is already on the trip.`;
          people.value.push(name);
          const message = `${name} joined the trip (${people.value.length} people now).`;
          logCall("add-person", { name }, message);
          return message;
        },
      }),
      useWebMCPTool({
        name: "add-expense",
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
            const message = `No "${payer}" on this trip. People: ${people.value.join(", ")}.`;
            logCall("add-expense", { payer, amount }, `error: ${message}`);
            throw message;
          }
          expenses.value.push({ payer, amount, description });
          const message = `Rs ${amount} from ${payer} for ${description}.`;
          logCall("add-expense", { payer, amount, description }, message);
          return message;
        },
      }),
      useWebMCPTool({
        name: "get-balances",
        description: "List each person's balance: who owes money and who gets money back",
        annotations: { readOnlyHint: true },
        execute() {
          const message = balances.value
            .map((b) => `${b.name} ${balanceLine(b)}`)
            .join("\n");
          logCall("get-balances", {}, message);
          return message;
        },
      }),
    ];

    const isSupported = tools[0].isSupported;
    const registeredCount = computed(
      () => tools.filter((tool) => tool.isRegistered.value).length + (showSettle.value ? 1 : 0),
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
      logCall,
      recordPayment,
      submitPerson,
      submitExpense,
      isSupported,
      registeredCount,
    };
  },
}).mount("#app");
