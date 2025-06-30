import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { DbService } from '../db-service';

app.http('pizzas-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'pizzas',
  handler: async (_request: HttpRequest, context: InvocationContext) => {
    context.log('Processing request to get all pizzas...');

    const dataService = await DbService.getInstance();
    const pizzas = await dataService.getPizzas();

    return {
      jsonBody: pizzas,
      status: 200
    };
  }
});

app.http('pizza-get-by-id', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'pizzas/{id}',
  handler: async (request: HttpRequest, _context: InvocationContext) => {
    const id = request.params.id;
    const dataService = await DbService.getInstance();
    const pizza = await dataService.getPizza(id);

    if (!pizza) {
      return {
        jsonBody: { error: 'Pizza not found' },
        status: 404
      };
    }

    return {
      jsonBody: pizza,
      status: 200
    };
  }
});