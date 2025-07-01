#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pizzaApiUrl } from "./config.js";
import { getMcpServer } from "./mcp.js";

try {
  const server = getMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `Pizza MCP server running on stdio (Using pizza API URL: ${pizzaApiUrl})`
  );
} catch (error) {
  console.error("Error starting MCP server:", error);
  process.exitCode = 1;
}
