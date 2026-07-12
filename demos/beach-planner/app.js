import { setupWebMCP } from "../../shared/webmcp.js";

const BEACHES = [
  { name: "Mont Choisy", region: "north", vibe: "lively" },
  { name: "Trou aux Biches", region: "north", vibe: "calm" },
  { name: "Pereybere", region: "north", vibe: "lively" },
  { name: "Belle Mare", region: "east", vibe: "calm" },
  { name: "Palmar", region: "east", vibe: "calm" },
  { name: "Blue Bay", region: "south", vibe: "calm" },
  { name: "Gris Gris", region: "south", vibe: "wild" },
  { name: "St Félix", region: "south", vibe: "calm" },
  { name: "Flic en Flac", region: "west", vibe: "lively" },
  { name: "Le Morne", region: "west", vibe: "wild" },
];

const beachesEl = document.getElementById("beaches");
const itineraryEl = document.getElementById("itinerary");
const plan = [];

function renderBeaches(list) {
  beachesEl.innerHTML = list.length
    ? list
        .map(
          (b) => `<li>
            <div>${b.name}</div>
            <div class="meta">${b.region} · ${b.vibe}</div>
          </li>`
        )
        .join("")
    : `<li class="muted">No beaches match — try a different filter.</li>`;
}

function renderItinerary() {
  itineraryEl.innerHTML = plan.length
    ? plan.map((p) => `<li>${p.day}: ${p.beach}</li>`).join("")
    : `<li class="muted">Nothing planned yet.</li>`;
}

// The forms are the tools — these handlers run whether a human clicks
// submit or an agent invokes the declarative tool.
document.querySelector('[toolname="filter-beaches"]').addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const region = data.get("region");
  const vibe = data.get("vibe");
  renderBeaches(
    BEACHES.filter(
      (b) => (region === "any" || b.region === region) && (vibe === "any" || b.vibe === vibe)
    )
  );
});

document.querySelector('[toolname="add-to-itinerary"]').addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  const query = String(data.get("beach") ?? "").toLowerCase();
  const beach = BEACHES.find((b) => b.name.toLowerCase().includes(query));
  if (!beach) return;
  plan.push({ beach: beach.name, day: data.get("day") });
  renderItinerary();
  e.target.reset();
});

renderBeaches(BEACHES);
renderItinerary();

// No imperative tools here on purpose — the badge still tells you whether
// an agent context is present.
setupWebMCP({ tools: [] });
