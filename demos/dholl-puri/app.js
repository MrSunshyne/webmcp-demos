import { setupWebMCP, textResult } from "../../shared/webmcp.js";

const MENU = [
  { id: "dholl-puri", name: "Dholl Puri (pair)", price: 30 },
  { id: "roti-chaud", name: "Roti Chaud", price: 25 },
  { id: "gato-piment", name: "Gato Piment (5)", price: 20 },
  { id: "extra-satini", name: "Extra Satini Pomme d'Amour", price: 10 },
  { id: "piment-crase", name: "Piment Crasé", price: 5 },
  { id: "alouda", name: "Alouda (big)", price: 50 },
];

const order = new Map(); // id -> quantity

const menuEl = document.getElementById("menu");
const itemsEl = document.getElementById("order-items");
const totalEl = document.getElementById("order-total");
const confirmationEl = document.getElementById("confirmation");

function findItem(query) {
  const q = query.toLowerCase();
  return MENU.find((m) => m.id === q || m.name.toLowerCase().includes(q));
}

function renderMenu() {
  menuEl.innerHTML = MENU.map(
    (m) => `<li>
      <div>${m.name}</div>
      <div class="price">Rs ${m.price}</div>
      <button data-add="${m.id}">Add</button>
    </li>`
  ).join("");
}

function renderOrder() {
  if (order.size === 0) {
    itemsEl.innerHTML = `<li class="muted">Nothing yet — hungry?</li>`;
    totalEl.textContent = "Rs 0";
    return;
  }
  let total = 0;
  itemsEl.innerHTML = [...order.entries()]
    .map(([id, qty]) => {
      const item = MENU.find((m) => m.id === id);
      total += item.price * qty;
      return `<li><span>${qty} × ${item.name}</span><span>Rs ${item.price * qty}</span></li>`;
    })
    .join("");
  totalEl.textContent = `Rs ${total}`;
}

function addToOrder(id, quantity = 1) {
  order.set(id, (order.get(id) ?? 0) + quantity);
  renderOrder();
}

function checkout(customerName = "friend") {
  if (order.size === 0) return null;
  const number = Math.floor(100 + Math.random() * 900);
  const total = totalEl.textContent;
  confirmationEl.style.display = "block";
  confirmationEl.textContent = `Order #${number} for ${customerName} — ${total}. Vini pran li dan 10 minit! 🛵`;
  order.clear();
  renderOrder();
  return { number, total };
}

menuEl.addEventListener("click", (e) => {
  const id = e.target.dataset?.add;
  if (id) addToOrder(id);
});

document.getElementById("checkout").addEventListener("click", () => checkout());

renderMenu();
renderOrder();

setupWebMCP({
  tools: [
    {
      name: "get_menu",
      description: "List everything the dholl puri stand sells, with prices in rupees.",
      inputSchema: { type: "object", properties: {} },
      execute() {
        return textResult(MENU.map((m) => `${m.name} — Rs ${m.price}`).join("; "));
      },
    },
    {
      name: "add_to_order",
      description: "Add an item to the current order. Item can be a menu id or a fuzzy name like 'dholl puri'.",
      inputSchema: {
        type: "object",
        properties: {
          item: { type: "string", description: "Menu item name or id" },
          quantity: { type: "number", description: "How many, defaults to 1" },
        },
        required: ["item"],
      },
      execute({ item, quantity = 1 }) {
        const found = findItem(item);
        if (!found) return textResult(`No '${item}' on the menu. Use get_menu to see what we have.`);
        addToOrder(found.id, quantity);
        return textResult(`Added ${quantity} × ${found.name}. Order total is now ${totalEl.textContent}.`);
      },
    },
    {
      name: "remove_from_order",
      description: "Remove an item from the current order entirely.",
      inputSchema: {
        type: "object",
        properties: { item: { type: "string", description: "Menu item name or id" } },
        required: ["item"],
      },
      execute({ item }) {
        const found = findItem(item);
        if (!found || !order.has(found.id)) return textResult(`'${item}' is not in the order.`);
        order.delete(found.id);
        renderOrder();
        return textResult(`Removed ${found.name}. Order total is now ${totalEl.textContent}.`);
      },
    },
    {
      name: "get_order",
      description: "Read back the current order and total. Does not change anything.",
      inputSchema: { type: "object", properties: {} },
      execute() {
        if (order.size === 0) return textResult("The order is empty.");
        const lines = [...order.entries()].map(([id, qty]) => {
          const m = MENU.find((x) => x.id === id);
          return `${qty} × ${m.name}`;
        });
        return textResult(`${lines.join(", ")} — total ${totalEl.textContent}.`);
      },
    },
    {
      name: "checkout",
      description: "Place the current order under the customer's name and get an order number.",
      inputSchema: {
        type: "object",
        properties: { customer_name: { type: "string", description: "Name for the order" } },
        required: ["customer_name"],
      },
      execute({ customer_name }) {
        const placed = checkout(customer_name);
        if (!placed) return textResult("Cannot check out — the order is empty.");
        return textResult(`Order #${placed.number} placed for ${customer_name}, ${placed.total}. Ready in 10 minutes.`);
      },
    },
  ],
});
