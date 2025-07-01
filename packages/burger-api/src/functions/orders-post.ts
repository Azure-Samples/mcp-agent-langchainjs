import process from 'node:process';
import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { DbService } from '../db-service';
import { OrderStatus, type OrderItem } from '../order';

interface CreateOrderRequest {
  userId: string;
  items: {
    burgerId: string;
    quantity: number;
    extraToppingIds?: string[];
  }[];
}

app.http('orders-post', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'orders',
  handler: async (request: HttpRequest, context: InvocationContext) => {
    context.log('Processing order creation request...');

    try {
      const dataService = await DbService.getInstance();
      const requestBody = await request.json() as CreateOrderRequest;
      context.log('Request body:', requestBody);

      // Validate userId is provided
      if (!requestBody.userId) {
        return {
          status: 400,
          jsonBody: { error: 'userId is required' }
        };
      }

      // Check if userId exists in the database
      const userExists = await dataService.userExists(requestBody.userId);
      if (!userExists) {
        const registrationUrl = process.env.REGISTRATION_WEBAPP_URL ?? '<unspecified>';
        return {
          status: 401,
          jsonBody: {
            error: `The specified userId is not registered. Please register to get a valid userId at: ${registrationUrl}`
          }
        };
      }

      if (!requestBody.items || !Array.isArray(requestBody.items) || requestBody.items.length === 0) {
        return {
          status: 400,
          jsonBody: { error: 'Order must contain at least one burger' }
        };
      }

      // Limit: max 5 active orders per user
      const activeOrders = await dataService.getOrders(requestBody.userId);
      const activeOrdersFiltered = activeOrders.filter(order =>
        order.status === OrderStatus.Pending || order.status === OrderStatus.InPreparation
      );
      if (activeOrdersFiltered.length >= 5) {
        return {
          status: 429,
          jsonBody: { error: 'Too many active orders: limit is 5 per user' }
        };
      }

      // Convert request items to order items
      const orderItems: OrderItem[] = [];
      let totalPrice = 0;

      for (const item of requestBody.items) {

        // Validate quantity is a positive integer
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          return {
            status: 400,
            jsonBody: { error: `Quantity for burgerId ${item.burgerId} must be a positive integer` }
          };
        }

        const burger = await dataService.getBurger(item.burgerId);
        if (!burger) {
          return {
            status: 400,
            jsonBody: { error: `Burger with ID ${item.burgerId} not found` }
          };
        }

        // Validate and calculate price for extra toppings
        let extraToppingsPrice = 0;
        if (item.extraToppingIds && item.extraToppingIds.length > 0) {
          for (const toppingId of item.extraToppingIds) {
            const topping = await dataService.getTopping(toppingId);
            if (!topping) {
              return {
                status: 400,
                jsonBody: { error: `Topping with ID ${toppingId} not found` }
              };
            }
            extraToppingsPrice += topping.price;
          }
        }

        const itemPrice = (burger.price + extraToppingsPrice) * item.quantity;
        totalPrice += itemPrice;

        orderItems.push({
          burgerId: item.burgerId,
          quantity: item.quantity,
          extraToppingIds: item.extraToppingIds
        });
      }

      // Calculate estimated completion time based on burger count
      const now = new Date();
      const burgerCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
      let minMinutes = 3;
      let maxMinutes = 5;
      if (burgerCount > 2) {
        minMinutes += burgerCount - 2;
        maxMinutes += burgerCount - 2;
      }
      // Random estimated time between min and max
      const estimatedMinutes = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
      const estimatedCompletionAt = new Date(now.getTime() + estimatedMinutes * 60000);

      // Create the order
      const orderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const order = await dataService.createOrder({
        id: orderId,
        userId: requestBody.userId,
        createdAt: now.toISOString(),
        items: orderItems,
        estimatedCompletionAt: estimatedCompletionAt.toISOString(),
        totalPrice,
        status: OrderStatus.Pending,
        completedAt: undefined
      });

      return {
        status: 201,
        jsonBody: order
      };
    } catch (error) {
      context.error('Error creating order:', error);
      return {
        status: 500,
        jsonBody: { error: 'Internal server error' }
      };
    }
  }
});
