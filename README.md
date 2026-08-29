# WebMCP Demos

Small, self-contained demos of [WebMCP](https://github.com/webmachinelearning/webmcp) — the proposed web standard that lets a page expose JavaScript functions and HTML forms as tools that in-browser AI agents can discover and call.

Background reading: [WebMCP: The Next User of Your Website is an Agent](https://sandeep.ramgolam.com/blog/webmcp-in-the-browser).

## Demos

| Demo | What it shows |
| --- | --- |
| [Dholl Puri Stand](demos/dholl-puri/) | Ordering flow with imperative tools (menu, cart, checkout) — the street food answer to Google's Pizza Maker |
| [Pixel Painter](demos/pixel-painter/) | An agent painting on a 16×16 canvas through batched tool calls |
| [Trip Splitter](demos/trip-splitter/) | Group expense splitting with Vue 3 and the [`vue-webmcp`](https://github.com/MrSunshyne/vue-webmcp) composable, loaded from an import map — a group registered with `useWebMCPTools()`, one more tied to a component's lifecycle, and an activity tape fed by the app-level call hooks |
| [Beach Permit](demos/beach-permit/) | The declarative API: two `<form toolname>`s wired with `useWebMCPForm()`, schemas synthesized by the browser from the markup, one handler answering both a click and an agent's call |
| [Tool Inspector](demos/tool-inspector/) | The consumer side: `useRegisteredTools()` discovering the page's own tools through `getTools()`, calling them through `executeTool()`, and following `toolchange` as a tool is registered and unregistered live |

More ideas on the shortlist, not built yet: a recipe scaler, a CSS theme mixer where the agent tunes design tokens.

## Running locally

No build step — any static server works:

```sh
pnpx vite
```

## Testing with an agent

WebMCP is in origin trial in Chrome. The quickest way to try the demos is the **WebMCP Model Context Tool Inspector** Chrome extension, which provides a simple agent that discovers and calls the registered tools. Without an agent every demo still works by hand, and the tool activity panel shows what an agent did or would do.

With no extension installed, [Tool Inspector](demos/tool-inspector/) does the same job from inside the page: it discovers the tools registered on itself and lets you call them by hand.
