import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { DbService } from '../db-service';

app.http('orders-delete', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'orders/{id}',
  handler: async (request: HttpRequest, context: InvocationContext) => {
    context.log('Processing order cancellation request...');
    context.log('Request params:', request.params);
    context.log('Request query:', request.query);

    try {
      const id = request.params?.id;

      if (!id) {
        return {
          status: 400,
          jsonBody: { error: 'Order ID is required' }
        };
      }

      const userId = request.query.get('userId');
      if (!userId) {
        return {
          status: 400,
          jsonBody: { error: 'userId is required as a query parameter' }
        };
      }

      const dataService = await DbService.getInstance();

      // Check if userId matches the order's userId
      const order = await dataService.getOrder(id, userId);
      if (!order) {
        return {
          status: 404,
          jsonBody: { error: 'Order not found' }
        };
      }

      const deletedSuccessfully = await dataService.deleteOrder(id, userId);

      if (!deletedSuccessfully) {
        return {
          status: 404,
          jsonBody: { error: 'Order not found or cannot be cancelled' }
        };
      }

      return {
        status: 200,
        jsonBody: { message: 'Order cancelled successfully', orderId: id }
      };
    } catch (error) {
      context.error('Error cancelling order:', error);
      return {
        status: 500,
        jsonBody: { error: 'Internal server error' }
      };
    }
  }
});
