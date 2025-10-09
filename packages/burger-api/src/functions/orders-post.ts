import process from 'node:process';
import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { DbService } from '../db-service.js';
import { OrderStatus, type OrderItem } from '../order.js';

interface CreateOrderRequest {
  userId: string;
  items: Array<{
    burgerId: string;
    quantity: number;
    extraToppingIds?: string[];
  }>;
  nickname?: string;
}

// Helper function for topping validation
async function validateAndCalculateToppingsPrice(
  dataService: DbService,
  toppingIds?: string[],
): Promise<number | { status: number; jsonBody: { error: string } }> {
  if (!toppingIds || toppingIds.length === 0) {
    return 0;
  }

  // Validate all toppings exist in parallel
  const toppingPromises = toppingIds.map(async (toppingId) => {
    const topping = await dataService.getTopping(toppingId);
    if (!topping) {
      throw new Error(`Topping with ID ${toppingId} not found`);
    }

    return topping.price;
  });

  try {
    const toppingPrices = await Promise.all(toppingPromises);
    return toppingPrices.reduce((sum, price) => sum + price, 0);
  } catch (error) {
    return {
      status: 400,
      jsonBody: { error: (error as Error).message },
    };
  }
}

app.http('orders-post', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'orders',
  async handler(request: HttpRequest, context: InvocationContext) {
    context.log('Processing order creation request...');

    try {
      const dataService = await DbService.getInstance();
      const requestBody = (await request.json()) as CreateOrderRequest;
      context.log('Request body:', requestBody);

      // Validate userId is provided
      if (!requestBody.userId) {
        return {
          status: 400,
          jsonBody: { error: 'userId is required' },
        };
      }

      // Check if userId exists in the database
      const userExists = await dataService.userExists(requestBody.userId);
      if (!userExists) {
        const registrationUrl = process.env.AGENT_WEBAPP_URL ?? '<unspecified>';
        return {
          status: 401,
          jsonBody: {
            error: `The specified userId is not registered. Please login to get a valid userId at: ${registrationUrl}`,
          },
        };
      }

      if (!requestBody.items || !Array.isArray(requestBody.items) || requestBody.items.length === 0) {
        return {
          status: 400,
          jsonBody: { error: 'Order must contain at least one burger' },
        };
      }

      // Limit: max 5 active orders per user
      const activeOrders = await dataService.getOrders(requestBody.userId);
      const activeOrdersFiltered = activeOrders.filter(
        (order) => order.status === OrderStatus.Pending || order.status === OrderStatus.InPreparation,
      );
      if (activeOrdersFiltered.length >= 5) {
        return {
          status: 429,
          jsonBody: { error: 'Too many active orders: limit is 5 per user' },
        };
      }

      // Convert request items to order items
      let totalPrice = 0;

      // Calculate total burger count and validate limit
      const totalBurgerCount = requestBody.items.reduce((sum, item) => sum + item.quantity, 0);
      if (totalBurgerCount > 50) {
        return {
          status: 400,
          jsonBody: { error: 'Order cannot exceed 50 burgers in total' },
        };
      }

      // Validate and process items in parallel
      const itemValidationPromises = requestBody.items.map(async (item) => {
        // Validate quantity is a positive integer
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          throw new Error(`Quantity for burgerId ${item.burgerId} must be a positive integer`);
        }

        const burger = await dataService.getBurger(item.burgerId);
        if (!burger) {
          throw new Error(`Burger with ID ${item.burgerId} not found`);
        }

        // Validate all extra toppings exist
        const extraToppingsPrice = await validateAndCalculateToppingsPrice(dataService, item.extraToppingIds);
        if (typeof extraToppingsPrice === 'object') {
          throw new TypeError(extraToppingsPrice.jsonBody.error);
        }

        const itemPrice = (burger.price + extraToppingsPrice) * item.quantity;

        return {
          orderItem: {
            burgerId: item.burgerId,
            quantity: item.quantity,
            extraToppingIds: item.extraToppingIds,
          },
          itemPrice,
        };
      });

      let validatedItems;
      try {
        validatedItems = await Promise.all(itemValidationPromises);
      } catch (error) {
        return {
          status: 400,
          jsonBody: { error: (error as Error).message },
        };
      }

      // Calculate total price and build order items
      const orderItems: OrderItem[] = [];
      for (const { orderItem, itemPrice } of validatedItems) {
        totalPrice += itemPrice;
        orderItems.push(orderItem);
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
      const estimatedCompletionAt = new Date(now.getTime() + estimatedMinutes * 60_000);

      // Create the order
      const orderId = `order-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const order = await dataService.createOrder({
        id: orderId,
        userId: requestBody.userId,
        createdAt: now.toISOString(),
        items: orderItems,
        estimatedCompletionAt: estimatedCompletionAt.toISOString(),
        totalPrice,
        status: OrderStatus.Pending,
        nickname: requestBody.nickname,
        completedAt: undefined,
      });

      return {
        status: 201,
        jsonBody: order,
      };
    } catch (error) {
      context.error('Error creating order:', error);
      return {
        status: 500,
        jsonBody: { error: 'Internal server error' },
      };
    }
  },
});
