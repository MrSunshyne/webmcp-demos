# WebMCP Demos

Small, self-contained demos of [WebMCP](https://github.com/webmachinelearning/webmcp) — the proposed web standard that lets a page expose JavaScript functions and HTML forms as tools that in-browser AI agents can discover and call.

Background reading: [WebMCP: The Next User of Your Website is an Agent](https://sandeep.ramgolam.com/blog/webmcp-in-the-browser).

## Demos

| Demo | What it shows |
| --- | --- |
| [Dholl Puri Stand](demos/dholl-puri/) | Ordering flow with imperative tools (menu, cart, checkout) — the street food answer to Google's Pizza Maker |
| [Pixel Painter](demos/pixel-painter/) | An agent painting on a 16×16 canvas through batched tool calls |

More ideas on the shortlist, not built yet: a declarative-forms demo (`toolname` attributes on plain HTML forms), a recipe scaler, an expense splitter for group trips, a CSS theme mixer where the agent tunes design tokens.

## Running locally

No build step — any static server works:

```sh
pnpx vite
```

## Testing with an agent

WebMCP is in origin trial in Chrome. The quickest way to try the demos is the **WebMCP Model Context Tool Inspector** Chrome extension, which provides a simple agent that discovers and calls the registered tools. Without an agent every demo still works by hand, and the tool activity panel shows what an agent did or would do.
