<div align="center">

# Beer MCP server

[![Open project in GitHub Codespaces](https://img.shields.io/badge/Codespaces-Open-blue?style=flat-square&logo=github)](https://codespaces.new/Microsoft/mcp-agent-langchainjs?hide_repo_select=true&ref=main&quickstart=true)
![Node version](https://img.shields.io/badge/Node.js->=22-3c873a?style=flat-square)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-404d59?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)

[Overview](#overview) • [MCP tools](#mcp-tools) • [Enable and test](#enable-and-test) • [Development](#development)

</div>

## Overview

This is the Beer MCP server, providing AI-powered beer recommendations using hybrid search (full-text + vector embeddings) with reranking. It exposes beer recommendation capabilities as a Model Context Protocol (MCP) server, allowing LLMs to suggest beers based on natural language queries.

This server supports the following transport types:

- **Streamable HTTP**
- **Stdio** (currently only supported when starting the server locally with `npm run start:local`)

The beer data and vector embeddings are stored in [Azure Cosmos DB](https://learn.microsoft.com/azure/cosmos-db/).

## MCP tools

The Beer MCP server provides the following tools:

| Tool Name        | Description                                                                 |
| ---------------- | --------------------------------------------------------------------------- |
| recommend_beers  | Recommend beers based on a natural language query (returns top 5 results)   |
| get_beer_by_id   | Get a specific beer by its ID                                               |

## Enable and test

The Beer MCP server is an optional component. To enable it:

1. Set the `ENABLE_BEERS` environment variable:
   ```bash
   azd env set ENABLE_BEERS true
   ```

2. Deploy the infrastructure and services:
   ```bash
   azd up
   ```

3. In the root `package.json`, replace `_start:beer` with `start:beer` to enable the local startup script.

4. Start all services:
   ```bash
   npm start
   ```

## Test with MCP inspector

1. Start the Beer MCP server locally.

2. In a terminal window, start MCP Inspector:
   ```bash
   npx -y @modelcontextprotocol/inspector
   ```
3. Ctrl+click to load the MCP Inspector web app from the URL displayed by the app (e.g. http://127.0.0.1:6274)
4. In the MCP Inspector, set the transport type to **Streamable HTTP** and put `http://localhost:3001/mcp` in the URL field, then click **Connect**.
5. In the **Tools** tab, select **List Tools**. Click on a tool and select **Run Tool**.

## Development

### Getting started

Follow the instructions [here](../../README.md#getting-started) to set up the development environment for the entire project.

### Run the application

You can run the following command to run the application server:

```bash
npm start
```

This will start the application server. The beer MCP server is then available at `http://localhost:3001/mcp` for the streamable HTTP endpoints.
