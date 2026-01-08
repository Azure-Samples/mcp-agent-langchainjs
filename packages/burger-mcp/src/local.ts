import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { burgerApiUrl } from './config.js';
import { getMcpServer } from './mcp.js';

try {
  const server = getMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Burger MCP server running on stdio (Using burger API URL: ${burgerApiUrl})`);
} catch (error) {
  console.error('Error starting MCP server:', error);
  process.exitCode = 1;
}
