## Big Picture
You have a smart chat helper (the “agent”) that can take your plain sentences like “Order me a cheeseburger with extra pickles,” and behind the scenes it talks to a burger service that knows about burgers, toppings, and orders. A special translator layer (MCP server) lets the chat agent call burger actions safely.

**Flow (who talks to whom):**
agent-webapp (your browser) → agent-api (brain) → burger-mcp (translator) → burger-api (burger shop data)

## The Cast (folders in packages)
- `agent-webapp`: The chat UI in the browser (what you see).
- `agent-api`: The server “agent brain”—uses LangChain.js + Azure OpenAI, stores chat history, knows who you are.
- `burger-mcp`: The MCP server exposing burger actions as tools the agent can call (like “list burgers”, “place order”).
- `burger-api`: The actual burger REST API: burgers, toppings, images, orders.
- `burger-webapp`: A plain burger browsing/order demo UI (non-AI).
- `agent-cli`: A command-line version of the agent (no browser).
- `burger-data`: Scripts that auto-generate burger items and images with AI (content seeding).

## How They Think Together
1. You type a message in `agent-webapp`.
2. `agent-api` receives it, uses an LLM (Azure OpenAI) + your past chats (in Cosmos DB) to decide next steps.
3. If it needs burger info, it calls `burger-mcp`.
4. `burger-mcp` turns that into real HTTP calls to `burger-api`.
5. Results bubble back up and appear as assistant messages.

## Why MCP?
MCP (Model Context Protocol) = a safe, structured way for the agent to call tools (like “get burger by id”) instead of hallucinating stuff.

## TL;DR
It’s a layered demo showing how an AI chat agent can safely call real backend capabilities (burger ordering) through MCP, with clean separation between UI, AI brain, protocol bridge, and business API.
