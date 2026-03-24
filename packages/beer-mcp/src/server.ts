import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Request, Response } from 'express';
import { DbService } from './db-service.js';
import { getMcpServer } from './mcp.js';
import { recommendBeers } from './recommendation.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const app = createMcpExpressApp();

app.get('/', async (_request: Request, response: Response) => {
  try {
    const db = await DbService.getInstance();
    const stats = await db.getStats();
    response.json({ status: 'up', stats });
  } catch {
    response.json({ status: 'up', message: 'Beer MCP server running (database not available)' });
  }
});

app.get('/openapi', (_request: Request, response: Response) => {
  const openapiPath = path.join(__dirname, '../openapi.yaml');
  const content = fs.readFileSync(openapiPath, 'utf8');
  response.type('text/yaml').send(content);
});

app.get('/api/beers/recommend', async (request: Request, response: Response) => {
  const query = request.query.query as string;
  if (!query) {
    response.status(400).json({ error: 'Missing required query parameter: query' });
    return;
  }

  try {
    const beers = await recommendBeers(query);
    response.json(beers);
  } catch (error: any) {
    console.error('Error recommending beers:', error);
    response.status(500).json({ error: error.message ?? 'Internal server error' });
  }
});

app.get('/api/beers/:id', async (request: Request, response: Response) => {
  try {
    const db = await DbService.getInstance();
    const beer = await db.getBeerById(request.params.id as string);
    if (!beer) {
      response.status(404).json({ error: 'Beer not found' });
      return;
    }

    response.json(beer);
  } catch (error: any) {
    console.error('Error fetching beer:', error);
    response.status(500).json({ error: error.message ?? 'Internal server error' });
  }
});

app.all('/mcp', async (request: Request, response: Response) => {
  console.log(`Received ${request.method} request to /mcp`);

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

    const server = getMcpServer();
    await server.connect(transport);
    await transport.handleRequest(request, response, request.body);

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Beer MCP server listening on port ${PORT}`);
});

process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  process.exit(0);
});
