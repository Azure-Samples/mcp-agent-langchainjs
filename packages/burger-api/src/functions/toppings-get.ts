import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { DbService } from '../db-service';
import { ToppingCategory } from '../topping';

app.http('toppings-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'toppings',
  handler: async (request: HttpRequest, context: InvocationContext) => {
    context.log('Processing request to get toppings...');
    context.log('Request query:', request.query);

    const dataService = await DbService.getInstance();
    const categoryParam = request.query.get('category');
    
    // If a category is specified, filter toppings by category
    if (categoryParam && Object.values(ToppingCategory).includes(categoryParam as ToppingCategory)) {
      const toppings = await dataService.getToppingsByCategory(categoryParam as ToppingCategory);
      return {
        jsonBody: toppings,
        status: 200
      };
    }
    
    // Otherwise return all toppings
    const toppings = await dataService.getToppings();
    return {
      jsonBody: toppings,
      status: 200
    };
  }
});

app.http('topping-get-by-id', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'toppings/{id}',
  handler: async (request: HttpRequest, _context: InvocationContext) => {
    const id = request.params.id;
    const dataService = await DbService.getInstance();
    const topping = await dataService.getTopping(id);

    if (!topping) {
      return {
        jsonBody: { error: 'Topping not found' },
        status: 404
      };
    }

    return {
      jsonBody: topping,
      status: 200
    };
  }
});

app.http('topping-categories-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'toppings/categories',
  handler: async (_request: HttpRequest, _context: InvocationContext) => {
    return {
      jsonBody: Object.values(ToppingCategory),
      status: 200
    };
  }
});
