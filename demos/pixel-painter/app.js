import { setupWebMCP, textResult } from "../../shared/webmcp.js";

const SIZE = 16;
const COLORS = ["#1f2937", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#ffffff"];

const board = document.getElementById("board");
const palette = document.getElementById("palette");
const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill("#ffffff"));
let brush = COLORS[0];
let painting = false;

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.x = x;
    cell.dataset.y = y;
    board.append(cell);
  }
}

palette.innerHTML = COLORS.map(
  (c) => `<button style="background:${c}" data-color="${c}" aria-pressed="${c === brush}" title="${c}"></button>`
).join("");

function paint(x, y, color) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return false;
  grid[y][x] = color;
  board.children[y * SIZE + x].style.background = color;
  return true;
}

function clearCanvas() {
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) paint(x, y, "#ffffff");
}

palette.addEventListener("click", (e) => {
  const color = e.target.dataset?.color;
  if (!color) return;
  brush = color;
  palette.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.color === brush));
});

const paintFromEvent = (e) => {
  const t = document.elementFromPoint(e.clientX, e.clientY);
  if (t?.dataset?.x) paint(+t.dataset.x, +t.dataset.y, brush);
};
board.addEventListener("pointerdown", (e) => {
  painting = true;
  paintFromEvent(e);
});
window.addEventListener("pointerup", () => (painting = false));
board.addEventListener("pointermove", (e) => painting && paintFromEvent(e));

document.getElementById("clear").addEventListener("click", clearCanvas);

setupWebMCP({
  tools: [
    {
      name: "paint_pixels",
      description:
        "Paint a batch of pixels on the 16x16 canvas. Coordinates are zero-indexed with (0,0) at the top-left. Colors are CSS colors like '#ef4444' or 'red'.",
      inputSchema: {
        type: "object",
        properties: {
          pixels: {
            type: "array",
            description: "Pixels to paint in one go",
            items: {
              type: "object",
              properties: {
                x: { type: "number" },
                y: { type: "number" },
                color: { type: "string" },
              },
              required: ["x", "y", "color"],
            },
          },
        },
        required: ["pixels"],
      },
      execute({ pixels }) {
        let ok = 0;
        for (const p of pixels) if (paint(p.x, p.y, p.color)) ok++;
        return textResult(`Painted ${ok}/${pixels.length} pixels.`);
      },
    },
    {
      name: "fill_canvas",
      description: "Fill the entire canvas with one color.",
      inputSchema: {
        type: "object",
        properties: { color: { type: "string", description: "A CSS color" } },
        required: ["color"],
      },
      execute({ color }) {
        for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) paint(x, y, color);
        return textResult(`Canvas filled with ${color}.`);
      },
    },
    {
      name: "clear_canvas",
      description: "Reset the canvas to white.",
      inputSchema: { type: "object", properties: {} },
      execute() {
        clearCanvas();
        return textResult("Canvas cleared.");
      },
    },
    {
      name: "read_canvas",
      description:
        "Read the canvas state without changing it. Returns one row per line, listing each pixel's color; white pixels are shown as '.'.",
      inputSchema: { type: "object", properties: {} },
      execute() {
        const rows = grid.map((row) => row.map((c) => (c === "#ffffff" ? "." : c)).join(" "));
        return textResult(rows.join("\n"));
      },
    },
  ],
});
