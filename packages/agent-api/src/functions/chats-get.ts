import process from 'node:process';
import { HttpRequest, HttpResponseInit, InvocationContext, app } from '@azure/functions';
import { AzureCosmsosDBNoSQLChatMessageHistory } from '@langchain/azure-cosmosdb';
import { FileSystemChatMessageHistory } from '../fs-history.js';
import { getCredentials, getInternalUserId } from '../auth.js';

async function getChats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
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

    if (sessionId) {
      const messages = await chatHistory.getMessages();
      const chatMessages = messages.map((message) => ({
        role: message.type === 'human' ? 'user' : 'assistant',
        content: message.content,
      }));
      return { jsonBody: chatMessages };
    }

    const sessions = await chatHistory.getAllSessions();
    const chatSessions = sessions.map((session) => ({
      id: session.id,
      title: session.context?.title,
    }));
    return { jsonBody: chatSessions };
  } catch (_error: unknown) {
    const error = _error as Error;
    context.error(`Error when processing chats-get request: ${error.message}`);

    return {
      status: 404,
      jsonBody: {
        error: 'Session not found',
      },
    };
  }
}

app.http('chats-get', {
  route: 'chats/{sessionId?}',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: getChats,
});
