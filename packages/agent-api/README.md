<div align="center">

# Agent API (Azure Functions + LangChain.js)

[![Open project in GitHub Codespaces](https://img.shields.io/badge/Codespaces-Open-blue?style=flat-square&logo=github)](https://codespaces.new/Azure-Samples/mcp-agent-langchainjs?hide_repo_select=true&ref=main&quickstart=true)
![Node version](https://img.shields.io/badge/Node.js->=22-3c873a?style=flat-square)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![LangChain.js](https://img.shields.io/badge/LangChain.js-1C3C3C?style=flat-square&logo=langchain&logoColor=white)](https://js.langchain.com)

[Overview](#overview) • [API Endpoints](#api-endpoints) • [Development](#development)

</div>

## Overview

The Agent API hosts the LangChain.js powered burger ordering agent. It:

- Streams chat completions with intermediate tool + LLM steps
- Connects to the Burger MCP server (Streamable HTTP) to invoke tools
- Persists chat history + session titles in Azure Cosmos DB for NoSQL
- Derives user identity from Azure Static Web Apps authentication
- Emits OpenTelemetry traces (to Azure Monitor if configured, else local OTLP exporter)

<div align="center">
	<img src="../../docs/images/agent-architecture.drawio.png" alt="Architecture" />
</div>

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/me | Returns (and lazily creates) the internal hashed user id for the authenticated user |
| GET | /api/chats | Lists all chat sessions for the current user |
| GET | /api/chats/{sessionId} | Returns messages for a specific session |
| DELETE | /api/chats/{sessionId} | Deletes a chat session and its messages |
| POST | /api/chats/stream | Streams an agent response for provided messages; creates/updates session |

### Streaming format

`POST /api/chats/stream` returns `application/x-ndjson`. Each line is a JSON object shaped like:

```jsonc
{
	"delta": {
    "content": "<partial text>",
    "role": "assistant",
    "context": { "currentStep": { ... } }
  },
	"context": { "sessionId": "<uuid>" }
}
```

Tool and LLM steps surface in `context.currentStep` / `context.intermediateSteps` enabling progressive UI rendering.

## Development

### Getting started

Follow the instructions [here](../../README.md#getting-started) to set up the development environment for the entire Burger MCP Agents project.

### Run the application

Use the following command to run the application locally:

```bash
npm start
```

This command will start the Azure Functions application locally. You can test the endpoints by opening the file `api.http` and click on **Send Request** to test the endpoints.

The agent API needs the Burger MCP server (and Burger API if running everything locally) to be running as well. You can start all the services at once by running `npm start` in the root of the project.

> [!NOTE]
> If you have not deployed the Azure resources, it will fall back to in-memory data. You can test the API without deploying it to Azure.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start the development server with hot reload |
| `npm run build` | Build the TypeScript source |
| `npm run clean` | Clean build artifacts |
| `update:local-settings` | Create or update `local.settings.json` needed by the Functions runtime |

## Configuration

The application uses environment variables for configuration:

| Variable | Required | Purpose | Default / Fallback |
|----------|----------|---------|--------------------|
| `AZURE_OPENAI_API_ENDPOINT` | Yes | Azure OpenAI endpoint used for chat completions | – |
| `AZURE_OPENAI_MODEL` | No | Model name passed to LangChain.js | `gpt-5-mini` |
| `BURGER_MCP_URL` | Yes* | Streamable HTTP endpoint of Burger MCP server | `http://localhost:3000/mcp` |
| `AZURE_COSMOSDB_NOSQL_ENDPOINT` | No | Enables persistent chat + session titles | In‑memory fallback |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | No | Sends traces to Azure Monitor | Local OTLP exporter |

> <sup>*</sup>The code defaults `BURGER_MCP_URL` to the local dev port; production must set this.

### Local OpenTelemetry traces

When running locally, spans are exported to `http://localhost:4318/v1/traces` and you can capture traces by running a local collector.

For example, you can use the [AI Toolkit VSCode extension](https://marketplace.visualstudio.com/items?itemName=ms-windows-ai-studio.windows-ai-studio) which includes a local OpenTelemetry collector. 

After installing the extension, open the **I Toolkit** panel in the sidebar, go to the **Tracing** tool under **Agent and workflow tools**, and select **Start Collector**. When calling the agent API, you should see traces appear in the panel. You will then be able to inspect each trace in detail: The one named `LangGraph` contains the full sequence of LLM calls and tool invocations, allowing you to see how the agent arrived at its final response.
