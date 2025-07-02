import { Readable } from 'node:stream';
import { HttpRequest, InvocationContext, HttpResponseInit, app } from '@azure/functions';
import { AIChatCompletionRequest, AIChatCompletionDelta } from '@microsoft/ai-chat-protocol';
import { AzureChatOpenAI } from '@langchain/openai';
import { AzureCosmsosDBNoSQLChatMessageHistory } from '@langchain/azure-cosmosdb';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { RunnableWithMessageHistory } from '@langchain/core/runnables';
import { ChatPromptTemplate, PromptTemplate } from '@langchain/core/prompts';
import { createToolCallingAgent } from "langchain/agents";
import { AgentExecutor } from "langchain/agents";
import { loadMcpTools } from "@langchain/mcp-adapters";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { v4 as uuidv4 } from 'uuid';
import 'dotenv/config';
import { badRequest, data, serviceUnavailable } from '../http-response.js';
import { getAzureOpenAiTokenProvider, getCredentials, getUserId } from '../security.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ChainValues } from '@langchain/core/utils/types.js';

const agentSystemPrompt = `
# Role
You an expert assistant that helps users with managing burger orders. Use the provided tools to get the information you need and perform actions on behalf of the user.
Only anwser to requests that are related to burger orders and the menu. If the user asks for something else, politely inform them that you can only assist with burger orders.

# Task
1. Help the user with their request, ask any clarifying questions if needed.
2. ALWAYS generate 3 very brief follow-up questions that the user would likely ask next.
Enclose the follow-up questions in double angle brackets. Example:
<<Am I allowed to invite friends for a party?>>
<<How can I ask for a refund?>>
<<What If I break something?>>
Make sure the last question ends with ">>".

# Instructions
- Always use the tools provided to get the information requested or perform any actions
- If you get any errors when trying to use a tool that does not seem related to missing parameters, try again
- If you cannot get the information needed to answer the user's question or perform the specified action, inform the user that you are unable to do so. Never make up information.
- The get_burger tool can help you get informations about the burgers
`;

const titleSystemPrompt = `Create a title for this chat session, based on the user question. The title should be less than 32 characters. Do NOT use double-quotes.`;

export async function postChats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const azureOpenAiEndpoint = process.env.AZURE_OPENAI_API_ENDPOINT;
  const burgerMcpEndpoint = process.env.BURGER_MCP_ENDPOINT;

  try {
    const requestBody = (await request.json()) as AIChatCompletionRequest;
    const { messages, context: chatContext } = requestBody;
    const userId = getUserId(request, requestBody);

    if (!messages || messages.length === 0 || !messages.at(-1)?.content) {
      return badRequest('Invalid or missing messages in the request body');
    }

    let model: BaseChatModel;
    let chatHistory;
    const sessionId = ((chatContext as any)?.sessionId as string) || uuidv4();
    context.log(`userId: ${userId}, sessionId: ${sessionId}`);

    if (!azureOpenAiEndpoint || !burgerMcpEndpoint) {
      const errorMessage = 'Missing required environment variables: AZURE_OPENAI_API_ENDPOINT or BURGER_MCP_ENDPOINT';
      context.error(errorMessage);
      return {
        status: 500,
        jsonBody: {
          error: errorMessage,
        },
      }
    }

    const credentials = getCredentials();
    const azureADTokenProvider = getAzureOpenAiTokenProvider();

    model = new AzureChatOpenAI({
      // Controls randomness. 0 = deterministic, 1 = maximum randomness
      temperature: 0.7,
      azureADTokenProvider,
    });

    // Initialize chat history
    chatHistory = new AzureCosmsosDBNoSQLChatMessageHistory({
      sessionId,
      userId,
      credentials,
    });

    const client = new Client({
      name: 'burger-mcp-client',
      version: '1.0.0'
    });
    const transport = new StreamableHTTPClientTransport(new URL(burgerMcpEndpoint));
    await client.connect(transport);
    context.log("Connected to Burger MCP server using Streamable HTTP transport");

    const tools = await loadMcpTools("burger", client, {
      // Whether to throw errors if a tool fails to load (optional, default: true)
      throwOnLoadError: true,
      // Whether to prefix tool names with the server name (optional, default: false)
      prefixToolNameWithServerName: false,
      // Optional additional prefix for tool names (optional, default: "")
      additionalToolNamePrefix: "",
    });

    for (const tool of tools) {
      if (!(tool.schema as any).properties) {
        (tool as any).schema = undefined;
      }
    }

    context.log(`Loaded ${tools.length} tools from Burger MCP server`);

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", agentSystemPrompt],
      ["placeholder", "{chat_history}"],
      ["human", "{input}"],
      ["placeholder", "{agent_scratchpad}"],
    ]);

    const agent = createToolCallingAgent({
      llm: model,
      tools,
      prompt,
    });
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      returnIntermediateSteps: true,
      verbose: true,
    });

    // Handle chat history
    const agentChainWithHistory = new RunnableWithMessageHistory({
      runnable: agentExecutor,
      inputMessagesKey: 'input',
      historyMessagesKey: 'chat_history',
      getMessageHistory: async () => chatHistory,
    });
    // Retriever to search for the documents in the database
    const question = messages.at(-1)!.content;
    const responseStream = await agentChainWithHistory.stream(
      { input: question },
      { configurable: { sessionId } },
    );
    const jsonStream = Readable.from(createJsonStream(responseStream, sessionId));

    // Create a short title for this chat session
    const { title } = await chatHistory.getContext();
    if (!title) {
      const response = await ChatPromptTemplate.fromMessages([
        ['system', titleSystemPrompt],
        ['human', '{input}'],
      ])
        .pipe(model)
        .invoke({ input: question });
      context.log(`Title for session: ${response.content as string}`);
      chatHistory.setContext({ title: response.content });
    }

    return data(jsonStream, {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
    });
  } catch (_error: unknown) {
    const error = _error as Error;
    context.error(`Error when processing chat-post request: ${error.message}`);

    return serviceUnavailable('Service temporarily unavailable. Please try again later.');
  }
}

// Transform the response chunks into a JSON stream
async function* createJsonStream(chunks: AsyncIterable<ChainValues>, sessionId: string) {
  for await (const chunk of chunks) {
    if (!chunk) continue;

    const responseChunk: AIChatCompletionDelta = {
      delta: {
        content: chunk.output ?? '',
        role: 'assistant',
        context: chunk.intermediateSteps ? {
          intermediateSteps: chunk.intermediateSteps,
        } : undefined,
      },
      context: {
        sessionId,
      },
    };

    // Format response chunks in Newline delimited JSON
    // see https://github.com/ndjson/ndjson-spec
    yield JSON.stringify(responseChunk) + '\n';
  }
}

app.setup({ enableHttpStream: true });
app.http('chats-post', {
  route: 'chats/stream',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: postChats,
});
