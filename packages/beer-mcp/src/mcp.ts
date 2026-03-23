import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DbService } from './db-service.js';
import { recommendBeers } from './recommendation.js';

export function getMcpServer() {
  const server = new McpServer({
    name: 'beer-mcp',
    version: '1.0.0',
  });

  server.registerTool(
    'recommend_beers',
    {
      description:
        'Recommend beers based on a natural language query. Returns the top 5 best beer recommendations matching the query, considering flavor profiles, food pairings, and beer styles.',
      inputSchema: z.object({
        query: z.string().describe('Natural language query describing desired beer characteristics, food pairings, or preferences'),
      }),
    },
    async (args) =>
      createToolResponse(async () => {
        const beers = await recommendBeers(args.query);
        return { beers };
      }),
  );

  server.registerTool(
    'get_beer_by_id',
    {
      description: 'Get detailed information about a specific beer by its ID',
      inputSchema: z.object({
        id: z.string().describe('ID of the beer to retrieve'),
      }),
    },
    async (args) =>
      createToolResponse(async () => {
        const db = await DbService.getInstance();
        const beer = await db.getBeerById(args.id);
        if (!beer) {
          throw new Error(`Beer with ID "${args.id}" not found`);
        }

        return beer;
      }),
  );

  return server;
}

async function createToolResponse(handler: () => Promise<Record<string, any>>) {
  try {
    const result = await handler();
    return {
      structuredContent: { result },
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result),
        },
      ],
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error executing MCP tool:', errorMessage);
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}
