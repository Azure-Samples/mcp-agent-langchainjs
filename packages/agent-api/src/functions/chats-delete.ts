import process from 'node:process';
import { HttpRequest, HttpResponseInit, InvocationContext, app } from '@azure/functions';
import { AzureCosmsosDBNoSQLChatMessageHistory } from '@langchain/azure-cosmosdb';
import { FileSystemChatMessageHistory } from '../fs-history.js';
import { getCredentials, getInternalUserId } from '../auth.js';

async function deleteChats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const azureCosmosDbEndpoint = process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT;
  const { sessionId } = request.params;
  const userId = await getInternalUserId(request);

  if (!userId) {
    return {
      status: 400,
      jsonBody: {
        error: 'Invalid or missing userId in the request',
      },
    };
  }

  if (!sessionId) {
    return {
      status: 400,
      jsonBody: {
        error: 'Invalid or missing sessionId in the request',
      },
    };
  }

  try {
    if (!azureCosmosDbEndpoint) {
      context.warn('Cosmos DB endpoint not found in environment variables. Falling back to in-memory storage.');
    }

    const credentials = getCredentials();
    const chatHistory = azureCosmosDbEndpoint
      ? new AzureCosmsosDBNoSQLChatMessageHistory({
          sessionId,
          userId,
          credentials,
          containerName: 'history',
          databaseName: 'historyDB',
        })
      : new FileSystemChatMessageHistory({ userId, sessionId });

    await chatHistory.clear();
    return { status: 204 };
  } catch (_error: unknown) {
    const error = _error as Error;
    context.error(`Error when processing chats-delete request: ${error.message}`);

    return {
      status: 404,
      jsonBody: {
        error: 'Session not found',
      },
    };
  }
}

app.http('chats-delete', {
  route: 'chats/{sessionId}',
  methods: ['DELETE'],
  authLevel: 'anonymous',
  handler: deleteChats,
});
