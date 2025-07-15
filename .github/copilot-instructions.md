# MCP Agent LangChain.js Project Instructions

## Architecture Overview

This is a multi-component LangChain.js demo showcasing AI agents with Model Context Protocol (MCP) integration. The system demonstrates a burger ordering platform with three main service layers:

- **Agent Layer**: AI chat interface (`agent-webapp` + `agent-api`) using LangChain.js agents with MCP tools
- **Business Layer**: Burger ordering API (`burger-api`) and webapp (`burger-webapp`)
- **MCP Layer**: Model Context Protocol server (`burger-mcp`) exposing burger API as LLM tools

### Component Communication Flow

```
agent-webapp → agent-api → burger-mcp → burger-api
```

The agent uses LangChain.js with Azure OpenAI, connects to the MCP server via StreamableHTTPClientTransport, and the MCP server proxies requests to the burger API.

## Key Architectural Patterns

### Authentication & State Management

- Azure Static Web Apps authentication provides `userId` context
- Cosmos DB for chat history storage using `@langchain/azure-cosmosdb`
- User context flows: SWA auth → agent-api → MCP tools (for user-specific operations)

### TypeScript & Build Conventions

- Shared XO linting config with project-specific overrides
- NPM workspace-based dependency management
- `.js` extensions required in imports for ESM compatibility
- Keep the code simple and straighforward: avoid unnecessary complexity and ensure clarity in implementation.
- Do not use comments except where absolutely necessary, code should be self-explanatory.

### Infrastructure as Code

- Bicep templates in `infra/` for Azure deployment
- `azure.yaml` defines multi-service deployment strategy:
  - `burger-api`, `agent-api`: Azure Functions (Flex Consumption)
  - `burger-mcp`: Container Apps with Docker
  - `*-webapp`: Static Web Apps
- Environment variables flow through Azure App Settings
- @azure Rule - Use Azure Best Practices: When generating code for Azure, running terminal commands for Azure, or performing operations related to Azure, invoke your `azure_development-get_best_practices` tool if available.
