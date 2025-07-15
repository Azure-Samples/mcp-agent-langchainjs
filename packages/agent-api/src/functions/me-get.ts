import { createHash } from 'node:crypto';
import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import { UserDbService } from '../user-db-service.js';
import { getUserId } from '../auth.js';

app.http('me-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'me',
  async handler(request: HttpRequest, context: InvocationContext) {
    try {
      const rawUserId = getUserId(request);
      if (!rawUserId) {
        return {
          status: 401,
          jsonBody: { error: 'Unauthorized' },
        };
      }

      const id = createHash('sha256').update(rawUserId).digest('hex').substring(0, 32);
      context.log(`User ID ${id}`);

      const db = await UserDbService.getInstance();
      let user = await db.getUserById(id);
      if (!user) {
        user = await db.createUser(id);
        context.log(`Created new user with ID: ${id}`);
      } else {
        context.log(`User exists, returning ID: ${user.id}`);
      }

      return {
        jsonBody: { id: user.id },
      };
    } catch (error) {
      context.error('Error in me-get handler', error);
      return {
        status: 500,
        jsonBody: { error: 'Internal Server Error' },
      };
    }
  },
});
