<div align="center">

# Burger MCP server (Azure Functions)

[![Open project in GitHub Codespaces](https://img.shields.io/badge/Codespaces-Open-blue?style=flat-square&logo=github)](https://codespaces.new/Microsoft/open-hack-build-25?hide_repo_select=true&ref=main&quickstart=true)
![Node version](https://img.shields.io/badge/Node.js->=22-3c873a?style=flat-square)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-404d59?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)

[Overview](#overview) • [MCP tools](#mcp-tools) • [Development](#development)

</div>

## Overview

This is the Burger MCP server, exposing the Burger API as a Model Context Protocol (MCP) server. The MCP server allows LLMs to interact with the burger ordering process through MCP tools.

This server supports the following transport types:

- **Streamable HTTP**
- **SSE** (legacy protocol, for backward compatibility)
- **Stdio** (currently only supported when starting the server locally with `npm start:local`)

The remote server is deployed with [Azure Functions](https://learn.microsoft.com/azure/azure-functions/functions-overview).

<div align="center">
  <img src="../../docs/images/burger-architecture.drawio.png" alt="Service architecture" />
</div>

## MCP tools

The Burger MCP server provides the following tools:

| Tool Name              | Description                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| get_burgers            | Get a list of all burgers in the menu                                                        |
| get_burger_by_id       | Get a specific burger by its ID                                                              |
| get_toppings           | Get a list of all toppings in the menu                                                       |
| get_topping_by_id      | Get a specific topping by its ID                                                             |
| get_topping_categories | Get a list of all topping categories                                                         |
| get_orders             | Get a list of all orders in the system                                                       |
| get_order_by_id        | Get a specific order by its ID                                                               |
| place_order            | Place a new order with burgers (requires `userId`, optional `nickname`)                      |
| delete_order_by_id     | Cancel an order if it has not yet been started (status must be `pending`, requires `userId`) |

## Test with MCP inspector

First, you need to start the Burger API and Burger MCP server locally.

1. In a terminal window, start MCP Inspector:
   ```bash
   npx -y @modelcontextprotocol/inspector
   ```
2. Ctrl+click to load the MCP Inspector web app from the URL displayed by the app (e.g. http://127.0.0.1:6274)
3. In the MCP Inspector, set the transport type to **Streamable HTTP** and
4. Put `http://localhost:3000/mcp` in the URL field and click on the **Connect** button.
5. In the **Tools** tab, select **List Tools**. Click on a tool and select **Run Tool**.

> [!NOTE]
> This application also provides an SSE endpoint if you use `/sse` instead of `/mcp` in the URL field.

## Development

### Getting started

Follow the instructions [here](../../README.md#getting-started) to set up the development environment for the entire Burger MCP Agents project.

### Run the application

You can run the following command to run the application server:

```bash
npm start
```

This will start the application server. The MCP server is then available at `http://localhost:3000/mcp` or `http://localhost:3000/sse` for the streamable HTTP and SSE endpoints, respectively.

Alternatively, you can run the MCP server with stdio transport using:

```bash
npm run start:local
```

By default, the MCP server will connect to the Burger API instance set by the `BURGER_API_URL` environment variable, or its value set in the root `.env` file. If not set, it will fall back to a local instance of the Burger API at `http://localhost:7071/`. You can force always using the local instance by setting adding the `--local` when starting the server, for example:

```bash
npm run start -- --local
```

### Available Scripts

| Script                          | Description                                                            |
| ------------------------------- | ---------------------------------------------------------------------- |
| `npm start`                     | Start the MCP server with HTTP and SSE endpoints                       |
| `npm run start:local`           | Start the MCP server with STDIO transport                              |
| `npm run dev`                   | Start the MCP server with hot reload                                   |
| `npm run dev:local`             | Start the MCP server with hot reload and STDIO transport               |
| `npm run build`                 | Build the TypeScript source                                            |
| `npm run clean`                 | Clean build artifacts                                                  |
| `npm run update:local-settings` | Create or update `local.settings.json` needed by the Functions runtime |

### Configuration

The application uses environment variables for configuration:

| Variable         | Description                  | Default                 |
| ---------------- | ---------------------------- | ----------------------- |
| `BURGER_API_URL` | URL of the Burger API server | `http://localhost:7071` |
