import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { DbService } from '../db-service';

// Get all orders endpoint
app.http('orders-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'orders',
  handler: async (request: HttpRequest, context: InvocationContext) => {
    context.log('Processing request to get all orders...');

    // Parse filters from query
    const userId = request.query.get('userId') ?? undefined;
    const statusParam = request.query.get('status');
    const lastParam = request.query.get('last');
    let statuses: string[] | undefined = undefined;
    if (statusParam) {
      statuses = statusParam.split(',').map((s) => s.trim().toLowerCase());
    }
    let lastMs: number | undefined = undefined;
    if (lastParam) {
      const match = lastParam.match(/^(\d+)([mh])$/i);
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        if (unit === 'm') lastMs = value * 60 * 1000;
        if (unit === 'h') lastMs = value * 60 * 60 * 1000;
      }
    }
    const dataService = await DbService.getInstance();
    const allOrders = await dataService.getOrders(userId);

    // Filter by status if provided
    let filteredOrders = allOrders;
    if (statuses && statuses.length > 0) {
      filteredOrders = allOrders.filter((order) => statuses.includes(order.status));
    }

    // Filter by time if provided
    if (lastMs) {
      const cutoffTime = new Date(Date.now() - lastMs);
      filteredOrders = filteredOrders.filter((order) => new Date(order.createdAt) >= cutoffTime);
    }

    return {
      jsonBody: filteredOrders,
      status: 200,
    };
  },
});

// Get single order by ID endpoint
app.http('orders-get-by-id', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'orders/{orderId}',
  handler: async (request: HttpRequest, _context: InvocationContext) => {
    const orderId = request.params.orderId;

    if (!orderId) {
      return {
        jsonBody: { error: 'Order ID is required' },
        status: 400,
      };
    }

    const dataService = await DbService.getInstance();
    const order = await dataService.getOrder(orderId);

    if (!order) {
      return {
        jsonBody: { error: 'Order not found' },
        status: 404,
      };
    }

    return {
      jsonBody: order,
      status: 200,
    };
  },
});
