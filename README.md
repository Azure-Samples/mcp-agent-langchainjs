<div align="center">

<img src="./packages/agent-webapp/public/favicon.png" alt="" align="center" height="64" />

# AI Agent with MCP tools using LangChain.js

[![Open in Codespaces](https://img.shields.io/badge/Codespaces-Open-blue?style=flat-square&logo=github)](https://codespaces.new/Azure-Samples/mcp-agent-langchainjs?hide_repo_select=true&ref=main&quickstart=true)
[![Join Azure AI Community Discord](https://img.shields.io/badge/Discord-Azure_AI_Community-blue?style=flat-square&logo=discord&color=5865f2&logoColor=fff)](https://discord.gg/kzRShWzttr)
<br>
[![Build Status](https://img.shields.io/github/actions/workflow/status/Azure-Samples/mcp-agent-langchainjs/build-test.yaml?style=flat-square&label=Build)](https://github.com/Azure-Samples/mcp-agent-langchainjs/actions)
![Node version](https://img.shields.io/badge/Node.js->=22-3c873a?style=flat-square)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

⭐ If you like this sample, star it on GitHub — it helps a lot!

[Overview](#overview) • [Architecture](#architecture) • [Getting started](#getting-started) • [MCP tools](#mcp-tools) • [Deploy to Azure](#deploy-to-azure) • [Resources](#resources) • [Troubleshooting](#troubleshooting)

![Animation showing the agent in action](./docs/images/demo.gif)

</div>

## Overview

This project demonstrates how to build AI agents that can interact with real-world APIs using the **Model Context Protocol (MCP)**. It features a complete burger ordering system with a serverless API, web interfaces, and an MCP server that enables AI agents to browse menus, place orders, and track order status. The agent uses **LangChain.js** to handle LLM reasoning and tool calling. The system consists of multiple interconnected services, as detailed in the [Architecture](#architecture) section below.

The system is hosted on [Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/overview) (web apps) and [Azure Functions](https://learn.microsoft.com/azure/azure-functions/functions-overview?pivots=programming-language-javascript) (API and MCP servers), with [Azure Cosmos DB for NoSQL](https://learn.microsoft.com/azure/cosmos-db/nosql/) for data storage. You can use it as a starting point for building your own AI agents.

<!-- > [!TIP]
> You can test this application locally without deployment needed or any cloud costs. The MCP server works with popular AI tools like GitHub Copilot, Claude, and other MCP-compatible clients. -->

### Key features

- LangChain.js agent with tool calling via MCP (Streamable HTTP transport)
- Multi-service, end‑to‑end architecture (web UIs, APIs, MCP server)
- User authentication with sessions history
- 100% serverless architecture, for cost-effective scaling
- Single-command deployment using Infrastructure as Code (IaC)

## Architecture

Building AI applications can be complex and time-consuming, but using LangChain.js and Azure serverless technologies allows to greatly simplify the process. This application is a AI agent that can be access through different interfaces (web app, CLI) and that can call tools through MCP to interact with a burger ordering API.

![Architecture diagram](docs/images/architecture.drawio.png?raw=true)

The application is made from these main components:

| Component | Folder | Purpose |
|-------|--------|---------|
| Agent Web App | [`packages/agent-webapp`](./packages/agent-webapp) | Chat interface + conversation rendering |
| Agent API | [`packages/agent-api`](./packages/agent-api) | LangChain.js agent + chat state + MCP client |
| Burger API | [`packages/burger-api`](./packages/burger-api) | Core burger & order management web API |
| Burger MCP Server | [`packages/burger-mcp`](./packages/burger-mcp) | Exposes burger API as MCP tools |
| Burger Web App | [`packages/burger-webapp`](./packages/burger-webapp) | Live orders visualization |
| Infrastructure | [`infra`](./infra) | Bicep templates (IaC) |

Additionally, these support components are included:

| Component | Folder | Purpose |
|-------|--------|---------|
| Agent CLI | [`packages/agent-cli`](./packages/agent-cli) | Command-line interface LangChain.js agent and MCP client |
| Data generation | [`packages/burger-data`](./packages/burger-data) | Scripts to (re)generate burgers data & images |

## Getting started

There are multiple ways to get started with this project. The quickest way is to use [GitHub Codespaces](#use-github-codespaces) that provides a preconfigured environment for you. Alternatively, you can [set up your local environment](#use-your-local-environment) following the instructions below.

<details open>
<summary><h3>Use GitHub Codespaces</h3></summary>

You can run this project directly in your browser by using GitHub Codespaces, which will open a web-based VS Code:

[![Open in GitHub Codespaces](https://img.shields.io/static/v1?style=flat-square&label=GitHub+Codespaces&message=Open&color=blue&logo=github)](https://codespaces.new/Azure-Samples/mcp-agent-langchainjs?hide_repo_select=true&ref=main&quickstart=true)

</details>

<details>
<summary><h3>Use a VSCode dev container</h3></summary>

A similar option to Codespaces is VS Code Dev Containers, that will open the project in your local VS Code instance using the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).

You will also need to have [Docker](https://www.docker.com/get-started/) installed on your machine to run the container.

[![Open in Dev Containers](https://img.shields.io/static/v1?style=flat-square&label=Dev%20Containers&message=Open&color=blue&logo=visualstudiocode)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/Azure-Samples/mcp-agent-langchainjs)

</details>

<details>
<summary><h3>Use your local environment</h3></summary>

You need to install following tools to work on your local machine:

- [Node.js LTS](https://nodejs.org/en/download)
- [Azure Developer CLI 1.19+](https://aka.ms/azure-dev/install)
- [Git](https://git-scm.com/downloads)
- [PowerShell 7+](https://github.com/powershell/powershell) _(for Windows users only)_
  - **Important**: Ensure you can run `pwsh.exe` from a PowerShell command. If this fails, you likely need to upgrade PowerShell.
  - Instead of Powershell, you can also use Git Bash or WSL to run the Azure Developer CLI commands.

Then you can get the project code:

1. [**Fork**](https://github.com/Azure-Samples/mcp-agent-langchainjs/fork) the project to create your own copy of this repository.
2. On your forked repository, select the **Code** button, then the **Local** tab, and copy the URL of your forked repository.

   ![Screenshot showing how to copy the repository URL](./docs/images/clone-url.png)
3. Open a terminal and run this command to clone the repo: `git clone <your-repo-url>`

</details>

### Local development

After setting up your environment, you can run the entire application locally:

```bash
# Install dependencies for all services
npm install

# Start all services locally
npm start
```

Starting the different services may take some time, you need to wait until you see the following message in the terminal: `🚀 All services ready 🚀`

This will start:
- **Agent Web App**: http://localhost:4280
- **Agent API**: http://localhost:7072  
- **Burger Web App**: http://localhost:5173
- **Burger API**: http://localhost:7071
- **Burger MCP Server**: http://localhost:3000

> [!NOTE]
> When running locally without having deployed the application, the servers will use in-memory storage, so any data will be lost when you stop the servers.
> After a successful deployment, the servers will use Azure Cosmos DB for persistent storage.

You can then open the Agent web app and ask things like:

- *What spicy burgers do you have?*
- *Order two Classic Cheeseburgers with extra bacon.*
- *Show my recent orders*

The agent will decide which MCP tool(s) to call, then come up with a response.

#### Available scripts

This project uses [npm workspaces](https://docs.npmjs.com/cli/v9/using-npm/workspaces) to manage multiple packages in a single repository. You can run scripts from the root folder that will apply to all packages, or you can run scripts for individual packages as indicated in their respective README files.

Common scripts (run from repo root):

| Action | Command |
|--------|---------|
| Start everything | `npm start` |
| Build all | `npm run build` |
| Lint | `npm run lint` |
| Fix lint | `npm run lint:fix` |
| Format | `npm run format` |

Per-package development (examples):

```bash
npm run start --workspace=burger-api      # Burger API (Functions)
npm run start --workspace=agent-api       # Agent API (Functions)
npm run start --workspace=burger-mcp      # MCP server (HTTP /mcp & /sse)
npm run start --workspace=agent-webapp    # Agent chat UI
npm run start --workspace=burger-webapp   # Orders dashboard
```

Use mock data where available:

```bash
npm run start:mock --workspace=agent-webapp
npm run start:mock --workspace=burger-webapp
```

## MCP tools

The Burger MCP server provides these tools for AI agents:

| Tool Name                | Description                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `get_burgers`            | Get a list of all burgers in the menu                                                        |
| `get_burger_by_id`       | Get a specific burger by its ID                                                              |
| `get_toppings`           | Get a list of all toppings in the menu                                                       |
| `get_topping_by_id`      | Get a specific topping by its ID                                                             |
| `get_topping_categories` | Get a list of all topping categories                                                         |
| `get_orders`             | Get a list of all orders in the system                                                       |
| `get_order_by_id`        | Get a specific order by its ID                                                               |
| `place_order`            | Place a new order with burgers (requires `userId`, optional `nickname`)                                           |
| `delete_order_by_id`     | Cancel an order if it has not yet been started (status must be `pending`, requires `userId`) |

### Testing the MCP Server

#### Using the MCP Inspector

You can test the MCP server using the MCP Inspector:

1. Install and start MCP Inspector:
   ```bash
   npx -y @modelcontextprotocol/inspector
   ```

2. In your browser, open the MCP Inspector (the URL will be shown in the terminal)

3. Configure the connection:
   - **Transport**: Streamable HTTP or SSE
   - **URL**: `http://localhost:3000/mcp` (for Streamable HTTP) or `http://localhost:3000/sse` (for legacy SSE)

4. Click **Connect** and explore the available tools

#### Using GitHub Copilot

To use the MCP server in local mode with GitHub Copilot, create a local `.vscode/mcp.json` configuration file in your project root:

```json
{
  "servers": {
    "burger-mcp": {
      "type": "stdio",
      "command": "npm",
      "args": ["run", "start:local", "--workspace=burger-mcp"]
    }
  }
}
```

If you open that file

Then, you can use GitHub Copilot in **agent mode** to interact with the MCP server. For example, you can ask questions like "What burgers are available?" or "Place an order for a vegan burger" and Copilot will use the MCP server to provide answers or perform actions. 

> [!TIP]
> Copilot models can behave differently regarding tools usage, so if you don't see it calling the `burger-mcp` tools, you can explicitly mention using the Bruger MCP server by adding `#burger-mcp` in your prompt.

## Deploy to Azure

### Prerequisites

- **Azure account**: If you're new to Azure, [get an Azure account for free](https://azure.microsoft.com/free) to get free Azure credits to get started
- **Azure account permissions**: Your Azure account must have `Microsoft.Authorization/roleAssignments/write` permissions, such as [Role Based Access Control Administrator](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#role-based-access-control-administrator-preview), [User Access Administrator](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#user-access-administrator), or [Owner](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#owner)

### Deploy to Azure

1. Open a terminal and navigate to the root of the project
2. Authenticate with Azure by running `azd auth login`
3. Run `azd up` to deploy the application to Azure. This will provision Azure resources and deploy all services
   - You will be prompted to select a base location for the resources
   - The deployment process will take a few minutes

Once deployment is complete, you'll see the URLs of all deployed services in the terminal.

### Cost estimation

Pricing varies per region and usage, so it isn't possible to predict exact costs for your usage. However, you can use the Azure pricing calculator with pre-configured estimations to get an idea of the costs: [Azure Pricing Calculator](https://azure.com/e/0ddf5e6a4c654576a74b7199c85413b9).

### Clean up resources

To clean up all the Azure resources created by this sample:

```bash
azd down --purge
```

## Resources

Here are some resources to learn more about the technologies used in this project:

- [Model Context Protocol](https://modelcontextprotocol.io/) - More about the MCP protocol
- [MCP for Beginners](https://github.com/microsoft/mcp-for-beginners) - A beginner-friendly introduction to MCP
- [Generative AI with JavaScript](https://github.com/microsoft/generative-ai-with-javascript) - Learn how to build Generative AI applications with JavaScript
- [Azure AI Travel Agents with Llamaindex.TS and MCP](https://github.com/Azure-Samples/azure-ai-travel-agents/) - Sample for building AI agents using Llamaindex.TS and MCP
- [Serverless AI Chat with RAG using LangChain.js](https://github.com/Azure-Samples/serverless-chat-langchainjs) - Sample for building a serverless AI chat grounded on your own data with LangChain.js

You can also find [more Azure AI samples here](https://github.com/Azure-Samples/azureai-samples).

## Troubleshooting

If you encounter issues while running or deploying this sample:

1. **Dependencies**: Ensure all required tools are installed and up to date
2. **Ports**: Make sure required ports (3000, 4280, 5173, 5174, 7071, 7072) are not in use
3. **Azure Developer CLI**: Verify you're authenticated with `azd auth login`
4. **Node.js version**: Ensure you're using Node.js 22 or higher

For more detailed troubleshooting, check the individual README files in each service directory.
