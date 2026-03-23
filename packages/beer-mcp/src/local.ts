import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getMcpServer } from './mcp.js';

try {
  const server = getMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Beer MCP server running on stdio');
} catch (error) {
  console.error('Error starting MCP server:', error);
  process.exitCode = 1;
}
