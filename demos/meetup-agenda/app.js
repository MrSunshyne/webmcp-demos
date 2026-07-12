import { setupWebMCP, textResult } from "../../shared/webmcp.js";

const state = {
  venue: null,
  date: null,
  start: "10:00",
  sessions: [], // { title, speaker, minutes }
};

const agendaEl = document.getElementById("agenda");

function slotTimes() {
  let [h, m] = state.start.split(":").map(Number);
  return state.sessions.map((s) => {
    const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    m += s.minutes;
    h += Math.floor(m / 60);
    m %= 60;
    return t;
  });
}

function render() {
  document.getElementById("venue").textContent = state.venue ?? "Venue TBD";
  document.getElementById("date").textContent = state.date ?? "Date TBD";
  document.getElementById("start").textContent = state.start;
  const times = slotTimes();
  agendaEl.innerHTML = state.sessions.length
    ? state.sessions
        .map(
          (s, i) => `<li>
            <span class="time">${times[i]}</span>
            <span>
              <span class="talk">${s.title}</span> <span class="speaker">${s.speaker ?? ""} · ${s.minutes} min</span>
            </span>
          </li>`
        )
        .join("")
    : `<li class="muted">No sessions yet.</li>`;
}

function agendaText() {
  if (!state.sessions.length) return "The agenda is empty.";
  const times = slotTimes();
  const lines = state.sessions.map((s, i) => `${times[i]} — ${s.title}${s.speaker ? ` (${s.speaker})` : ""}, ${s.minutes} min`);
  return `${state.venue ?? "Venue TBD"}, ${state.date ?? "date TBD"}:\n${lines.join("\n")}`;
}

render();

setupWebMCP({
  tools: [
    {
      name: "set_meetup_info",
      description: "Set the venue, date, and/or start time for the meetup.",
      inputSchema: {
        type: "object",
        properties: {
          venue: { type: "string" },
          date: { type: "string", description: "Human readable date" },
          start: { type: "string", description: "Start time as HH:MM, defaults to 10:00" },
        },
      },
      execute({ venue, date, start }) {
        if (venue) state.venue = venue;
        if (date) state.date = date;
        if (start) state.start = start;
        render();
        return textResult(`Meetup set: ${state.venue ?? "venue TBD"}, ${state.date ?? "date TBD"}, starts ${state.start}.`);
      },
    },
    {
      name: "add_session",
      description: "Append a session to the agenda. Times are computed from the running order.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          speaker: { type: "string", description: "Optional speaker name" },
          minutes: { type: "number", description: "Duration in minutes, defaults to 30" },
        },
        required: ["title"],
      },
      execute({ title, speaker, minutes = 30 }) {
        state.sessions.push({ title, speaker, minutes });
        render();
        return textResult(`Added "${title}" (${minutes} min). The agenda now has ${state.sessions.length} sessions.`);
      },
    },
    {
      name: "remove_session",
      description: "Remove a session from the agenda by (partial) title.",
      inputSchema: {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
      },
      execute({ title }) {
        const i = state.sessions.findIndex((s) => s.title.toLowerCase().includes(title.toLowerCase()));
        if (i === -1) return textResult(`No session matching "${title}".`);
        const [removed] = state.sessions.splice(i, 1);
        render();
        return textResult(`Removed "${removed.title}".`);
      },
    },
    {
      name: "move_session",
      description: "Move a session to a new position in the running order (1 = first).",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          position: { type: "number" },
        },
        required: ["title", "position"],
      },
      execute({ title, position }) {
        const i = state.sessions.findIndex((s) => s.title.toLowerCase().includes(title.toLowerCase()));
        if (i === -1) return textResult(`No session matching "${title}".`);
        const [s] = state.sessions.splice(i, 1);
        state.sessions.splice(Math.max(0, Math.min(state.sessions.length, position - 1)), 0, s);
        render();
        return textResult(`Moved "${s.title}" to position ${position}.`);
      },
    },
    {
      name: "get_agenda",
      description: "Read the full agenda with computed times. Does not change anything.",
      annotations: { readOnlyHint: true },
      inputSchema: { type: "object", properties: {} },
      execute() {
        return textResult(agendaText());
      },
    },
  ],
});
