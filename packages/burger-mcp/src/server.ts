import process from 'node:process';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Request, Response } from 'express';
import { burgerApiUrl } from './config.js';
import { getMcpServer } from './mcp.js';

// Create the Express app with DNS rebinding protection
const app = createMcpExpressApp();

app.get('/', (_request: Request, response: Response) => {
  response.send({ status: 'up', message: `Burger MCP server running (Using burger API URL: ${burgerApiUrl})` });
});

// Handle all MCP Streamable HTTP requests (GET, POST, DELETE) on a single endpoint
app.all('/mcp', async (request: Request, response: Response) => {
  console.log(`Received ${request.method} request to /mcp`);

  // Reject unsupported methods (GET/DELETE are only needed for stateful sessions)
  if (request.method === 'GET' || request.method === 'DELETE') {
    response.writeHead(405).end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32_000,
          message: 'Method not allowed.',
        },
        id: null,
      }),
    );
    return;
  }

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Connect the transport to the MCP server
    const server = getMcpServer();
    await server.connect(transport);

    // Handle the request with the transport
    await transport.handleRequest(request, response, request.body);

    // Clean up when the response is closed
    response.on('close', async () => {
      await transport.close();
      await server.close();
    });
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!response.headersSent) {
      response.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32_603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Burger MCP server listening on port ${PORT} (Using burger API URL: ${burgerApiUrl})`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  process.exit(0);
});
