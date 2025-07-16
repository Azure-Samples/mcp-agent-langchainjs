import { z } from 'zod';
import type { ZodRawShape } from 'zod/v4/classic/compat';
import { burgerApiUrl } from './config.js';

export const tools = [
  {
    name: 'get_burgers',
    description: 'Get a list of all burgers in the menu',
    handler: async () => {
      return fetchBurgerApi('/api/burgers');
    },
  },
  {
    name: 'get_burger_by_id',
    description: 'Get a specific burger by its ID',
    schema: z.object({
      id: z.string().describe('ID of the burger to retrieve'),
    }),
    handler: async (args: ZodRawShape) => {
      return fetchBurgerApi(`/api/burgers/${args.id}`);
    },
  },
  {
    name: 'get_toppings',
    description: 'Get a list of all toppings in the menu',
    schema: z.object({
      category: z.string().optional().describe('Category of toppings to filter by (can be empty)'),
    }),
    handler: async (args: ZodRawShape) => {
      return fetchBurgerApi(`/api/toppings?category=${args.category ?? ''}`);
    },
  },
  {
    name: 'get_topping_by_id',
    description: 'Get a specific topping by its ID',
    schema: z.object({
      id: z.string().describe('ID of the topping to retrieve'),
    }),
    handler: async (args: ZodRawShape) => {
      return fetchBurgerApi(`/api/toppings/${args.id}`);
    },
  },
  {
    name: 'get_topping_categories',
    description: 'Get a list of all topping categories',
    handler: async (_args: ZodRawShape) => {
      return fetchBurgerApi('/api/toppings/categories');
    },
  },
  {
    name: 'get_orders',
    description: 'Get a list of orders in the system',
    schema: z.object({
      userId: z.string().optional().describe('Filter orders by user ID'),
      status: z.string().optional().describe('Filter by order status. Comma-separated list allowed.'),
      last: z.string().optional().describe("Filter orders created in the last X minutes or hours (e.g. '60m', '2h')"),
    }),
    handler: async (args: { userId?: string; status?: string; last?: string }) => {
      const params = new URLSearchParams();
      if (args.userId) params.append('userId', args.userId);
      if (args.status) params.append('status', args.status);
      if (args.last) params.append('last', args.last);
      const query = params.toString();
      const url = query ? `/api/orders?${query}` : '/api/orders';
      return fetchBurgerApi(url);
    },
  },
  {
    name: 'get_order_by_id',
    description: 'Get a specific order by its ID',
    schema: z.object({
      id: z.string().describe('ID of the order to retrieve'),
    }),
    handler: async (args: ZodRawShape) => {
      return fetchBurgerApi(`/api/orders/${args.id}`);
    },
  },
  {
    name: 'place_order',
    description: 'Place a new order with burgers (requires userId)',
    schema: z.object({
      userId: z.string().describe('ID of the user placing the order'),
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
    handler: async (args: ZodRawShape) => {
      return fetchBurgerApi('/api/orders', {
        method: 'POST',
        body: JSON.stringify(args),
      });
    },
  },
  {
    name: 'delete_order_by_id',
    description: 'Cancel an order if it has not yet been started (status must be "pending", requires userId)',
    schema: z.object({
      id: z.string().describe('ID of the order to cancel'),
      userId: z.string().describe('ID of the user that placed the order'),
    }),
    handler: async (args: ZodRawShape) => {
      return fetchBurgerApi(`/api/orders/${args.id}?userId=${args.userId}`, {
        method: 'DELETE',
      });
    },
  },
];

// Wraps standard fetch to include the base URL and handle errors
async function fetchBurgerApi(url: string, options: RequestInit = {}): Promise<string> {
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
      return 'Operation completed successfully. No content returned.';
    }
    return JSON.stringify(await response.json());
  } catch (error: any) {
    console.error(`Error fetching ${fullUrl}:`, error);
    throw error;
  }
}
