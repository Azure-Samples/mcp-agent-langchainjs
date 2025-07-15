import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { DbService } from '../db-service';
import { OrderStatus } from '../order';

app.http('status-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: '{ignored:maxlength(0)?}', // empty route, just using an empty string isn't working
  handler: async (_request: HttpRequest, context: InvocationContext) => {
    context.log('Processing request to get server status...');

    try {
      const dataService = await DbService.getInstance();
      const orders = await dataService.getOrders();
      const registeredUsers = await dataService.getRegisteredUsers();

      // Count active orders (orders that are not completed or cancelled)
      const activeOrders = orders.filter(
        (order) => order.status !== OrderStatus.Completed && order.status !== OrderStatus.Cancelled,
      );

      return {
        jsonBody: {
          status: 'up',
          activeOrders: activeOrders.length,
          totalOrders: orders.length,
          registeredUsers,
          timestamp: new Date().toISOString(),
        },
        status: 200,
      };
    } catch (error) {
      context.error('Error processing server status request:', error);

      return {
        jsonBody: {
          status: 'up',
          error: 'Error retrieving order information',
          timestamp: new Date().toISOString(),
        },
        status: 200, // Still return 200 to indicate the server is up
      };
    }
  },
});
