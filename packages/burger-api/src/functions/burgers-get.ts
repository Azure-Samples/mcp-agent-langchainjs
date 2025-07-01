import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { DbService } from '../db-service';

app.http('burgers-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'burgers',
  handler: async (_request: HttpRequest, context: InvocationContext) => {
    context.log('Processing request to get all burgers...');

    const dataService = await DbService.getInstance();
    const burgers = await dataService.getBurgers();

    return {
      jsonBody: burgers,
      status: 200
    };
  }
});

app.http('burger-get-by-id', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'burgers/{id}',
  handler: async (request: HttpRequest, _context: InvocationContext) => {
    const id = request.params.id;
    const dataService = await DbService.getInstance();
    const burger = await dataService.getBurger(id);

    if (!burger) {
      return {
        status: 404,
        jsonBody: { message: 'Burger not found' }
      };
    }

    return {
      jsonBody: burger,
      status: 200
    };
  }
});
