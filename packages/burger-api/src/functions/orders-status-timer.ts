import { app, InvocationContext } from '@azure/functions';
import { DbService } from '../db-service.js';
import { OrderStatus } from '../order.js';

app.timer('orders-status-timer', {
  // Runs every 40 seconds
  schedule: '*/40 * * * * *',
  async handler(_timer, context: InvocationContext) {
    context.log('Order status timer triggered');
    const db = await DbService.getInstance();
    const startTime = Date.now();
    const now = new Date();

    const allOrders = await db.getOrders();
    const orders = allOrders.filter((order) =>
      [OrderStatus.Pending, OrderStatus.InPreparation, OrderStatus.Ready].includes(order.status),
    );
    const updatePromises: Array<Promise<{ id: string; status: string; success: boolean; error?: Error }>> = [];
    for (const order of orders) {
      switch (order.status) {
        case OrderStatus.Pending: {
          const minutesSinceCreated = (now.getTime() - new Date(order.createdAt).getTime()) / 60_000;
          if (minutesSinceCreated > 3 || (minutesSinceCreated >= 1 && Math.random() < 0.5)) {
            updatePromises.push(
              db
                .updateOrder(order.id, { status: OrderStatus.InPreparation })
                .then(() => ({ id: order.id, status: 'in-preparation', success: true }))
                .catch((error: any) => {
                  context.error(`ERROR: Failed to update order ${order.id} to in-preparation:`, error);
                  return { id: order.id, status: 'in-preparation', success: false, error };
                }),
            );
          }

          break;
        }

        case OrderStatus.InPreparation: {
          const estimatedCompletionAt = new Date(order.estimatedCompletionAt);
          const diffMinutes = (now.getTime() - estimatedCompletionAt.getTime()) / 60_000;
          if (diffMinutes > 3 || (Math.abs(diffMinutes) <= 3 && Math.random() < 0.5)) {
            updatePromises.push(
              db
                .updateOrder(order.id, { status: OrderStatus.Ready, readyAt: now.toISOString() })
                .then(() => ({ id: order.id, status: 'ready', success: true }))
                .catch((error: any) => {
                  context.error(`ERROR: Failed to update order ${order.id} to ready:`, error);
                  return { id: order.id, status: 'ready', success: false, error };
                }),
            );
          }

          break;
        }

        case OrderStatus.Ready: {
          if (order.readyAt) {
            const readyAt = new Date(order.readyAt);
            const minutesSinceReady = (now.getTime() - readyAt.getTime()) / 60_000;
            if (minutesSinceReady >= 1 && (minutesSinceReady > 2 || Math.random() < 0.5)) {
              updatePromises.push(
                db
                  .updateOrder(order.id, { status: OrderStatus.Completed, completedAt: now.toISOString() })
                  .then(() => ({ id: order.id, status: 'completed', success: true }))
                  .catch((error: any) => {
                    context.error(`ERROR: Failed to update order ${order.id} to completed:`, error);
                    return { id: order.id, status: 'completed', success: false, error };
                  }),
              );
            }
          }

          break;
        }
        // No default
      }
    }

    const results = await Promise.all(updatePromises);
    const updated = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const elapsedMs = Date.now() - startTime;
    context.log(`Order status updates: ${updated} orders updated, ${failed} failed (time elapsed: ${elapsedMs}ms)`);
  },
});
