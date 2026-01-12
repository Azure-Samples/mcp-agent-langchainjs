import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { burgerApiUrl } from './config.js';

export function getMcpServer() {
  const server = new McpServer({
    name: 'burger-mcp',
    version: '1.0.0',
  });

  // Get the list of available burgers
  server.registerTool(
    'get_burgers',
    {
      description: 'Get a list of all burgers in the menu',
    },
    async () =>
      createToolResponse(async () => {
        return fetchBurgerApi('/api/burgers');
      }),
  );

  // Get a specific burger by its ID
  server.registerTool(
    'get_burger_by_id',
    {
      description: 'Get a specific burger by its ID',
      inputSchema: z.object({
        id: z.string().describe('ID of the burger to retrieve'),
      }),
    },
    async (args) =>
      createToolResponse(async () => {
        return fetchBurgerApi(`/api/burgers/${args.id}`);
      }),
  );

  // Get the list of available toppings
  server.registerTool(
    'get_toppings',
    {
      description: 'Get a list of all toppings in the menu',
      inputSchema: z.object({
        category: z.string().optional().describe('Category of toppings to filter by (can be empty)'),
      }),
    },
    async (args) =>
      createToolResponse(async () => {
        return fetchBurgerApi(`/api/toppings?category=${args.category ?? ''}`);
      }),
  );

  // Get a specific topping by its ID
  server.registerTool(
    'get_topping_by_id',
    {
      description: 'Get a specific topping by its ID',
      inputSchema: z.object({
        id: z.string().describe('ID of the topping to retrieve'),
      }),
    },
    async (args) =>
      createToolResponse(async () => {
        return fetchBurgerApi(`/api/toppings/${args.id}`);
      }),
  );

  // Get a list of all topping categories
  server.registerTool(
    'get_topping_categories',
    {
      description: 'Get a list of all topping categories',
    },
    async () =>
      createToolResponse(async () => {
        return fetchBurgerApi('/api/toppings/categories');
      }),
  );

  // Get a list of orders in the system
  server.registerTool(
    'get_orders',
    {
      description: 'Get a list of orders in the system',
      inputSchema: z.object({
        userId: z.string().optional().describe('Filter orders by user ID'),
        status: z.string().optional().describe('Filter by order status. Comma-separated list allowed.'),
        last: z.string().optional().describe("Filter orders created in the last X minutes or hours (e.g. '60m', '2h')"),
      }),
    },
    async (args) =>
      createToolResponse(async () => {
        const parameters = new URLSearchParams();
        if (args.userId) parameters.append('userId', args.userId);
        if (args.status) parameters.append('status', args.status);
        if (args.last) parameters.append('last', args.last);
        const query = parameters.toString();
        const url = query ? `/api/orders?${query}` : '/api/orders';
        return fetchBurgerApi(url);
      }),
  );

  // Get a specific order by its ID
  server.registerTool(
    'get_order_by_id',
    {
      description: 'Get a specific order by its ID',
      inputSchema: z.object({
        id: z.string().describe('ID of the order to retrieve'),
      }),
    },
    async (args) =>
      createToolResponse(async () => {
        return fetchBurgerApi(`/api/orders/${args.id}`);
      }),
  );

  // Place order
  server.registerTool(
    'place_order',
    {
      description: 'Place a new order with burgers (requires userId)',
      inputSchema: z.object({
        userId: z.string().describe('ID of the user placing the order'),
        nickname: z.string().optional().describe('Optional nickname for the order (only first 10 chars displayed)'),
        items: z
          .array(
            z.object({
              burgerId: z.string().describe('ID of the burger'),
              quantity: z.number().min(1).describe('Quantity of the burger'),
              extraToppingIds: z.array(z.string()).describe('List of extra topping IDs'),
            }),
          )
          .nonempty()
          .describe('List of items in the order'),
      }),
    },
    async (args) =>
      createToolResponse(async () => {
        return fetchBurgerApi('/api/orders', {
          method: 'POST',
          body: JSON.stringify(args),
        });
      }),
  );

  // Delete order by ID
  server.registerTool(
    'delete_order_by_id',
    {
      description: 'Cancel an order if it has not yet been started (status must be "pending", requires userId)',
      inputSchema: z.object({
        id: z.string().describe('ID of the order to cancel'),
        userId: z.string().describe('ID of the user that placed the order'),
      }),
    },
    async (args) =>
      createToolResponse(async () => {
        return fetchBurgerApi(`/api/orders/${args.id}?userId=${args.userId}`, {
          method: 'DELETE',
        });
      }),
  );

  return server;
}

// Wraps standard fetch to include the base URL and handle errors
async function fetchBurgerApi(url: string, options: RequestInit = {}): Promise<Record<string, any>> {
  const fullUrl = new URL(url, burgerApiUrl).toString();
  console.error(`Fetching ${fullUrl}`);
  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Error fetching ${fullUrl}: ${response.statusText}`);
    }

    if (response.status === 204) {
      return { result: 'Operation completed successfully. No content returned.' };
    }

    return await response.json();
  } catch (error: any) {
    console.error(`Error fetching ${fullUrl}:`, error);
    throw error;
  }
}

// Helper to create MCP tool responses with error handling
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
