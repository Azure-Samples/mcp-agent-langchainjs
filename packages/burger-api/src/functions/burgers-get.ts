import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { DbService } from '../db-service';
import { Burger } from '../burger';

function transformBurgerImageUrl(burger: Burger, request: HttpRequest): Burger {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  return {
    ...burger,
    imageUrl: `${baseUrl}/api/images/${burger.imageUrl}`,
  };
}

app.http('burgers-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'burgers',
  handler: async (request: HttpRequest, context: InvocationContext) => {
    context.log('Processing request to get all burgers...');

    const dataService = await DbService.getInstance();
    const burgers = await dataService.getBurgers();

    // Transform imageUrl to include full URL
    const burgersWithFullUrls = burgers.map((burger) => transformBurgerImageUrl(burger, request));

    return {
      jsonBody: burgersWithFullUrls,
      status: 200,
    };
  },
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
        jsonBody: { message: 'Burger not found' },
      };
    }

    // Transform imageUrl to include full URL
    const burgerWithFullUrl = transformBurgerImageUrl(burger, request);

    return {
      jsonBody: burgerWithFullUrl,
      status: 200,
    };
  },
});
