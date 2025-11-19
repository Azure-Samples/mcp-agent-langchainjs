import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { HttpRequest, InvocationContext, HttpResponseInit, app } from '@azure/functions';
import { createAgent, AIMessage, HumanMessage } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { AzureCosmsosDBNoSQLChatMessageHistory } from '@langchain/azure-cosmosdb';
import { loadMcpTools } from '@langchain/mcp-adapters';
import { StreamEvent } from '@langchain/core/tracers/log_stream';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getAzureOpenAiTokenProvider, getCredentials, getInternalUserId } from '../auth.js';
import { type AIChatCompletionRequest, type AIChatCompletionDelta } from '../models.js';

const agentSystemPrompt = `## Role
You an expert assistant that helps users with managing burger orders. Use the provided tools to get the information you need and perform actions on behalf of the user.
Only answer to requests that are related to burger orders and the menu. If the user asks for something else, politely inform them that you can only assist with burger orders.
Be conversational and friendly, like a real person would be, but keep your answers concise and to the point.

## Context
The restaurant is called Contoso Burgers. Contoso Burgets always provides french fries and a fountain drink with every burger order, so there's no need to add them to orders.

## Task
1. Help the user with their request, ask any clarifying questions if needed.
2. ALWAYS generate 3 very brief follow-up questions that the user would likely ask next, as if you were the user.
Enclose the follow-up questions in double angle brackets. Example:
<<Am I allowed to invite friends for a party?>>
<<How can I ask for a refund?>>
<<What If I break something?>>
Make sure the last question ends with ">>", and phrase the questions as if you were the user, not the assistant.

## Instructions
- Always use the tools provided to get the information requested or perform any actions
- If you get any errors when trying to use a tool that does not seem related to missing parameters, try again
- If you cannot get the information needed to answer the user's question or perform the specified action, inform the user that you are unable to do so. Never make up information.
- The get_burger tool can help you get informations about the burgers
- Creating or cancelling an order requires the userId, which is provided in the request context. Never ask the user for it or confirm it in your responses.
- Use GFM markdown formatting in your responses, to make your answers easy to read and visually appealing. You can use tables, headings, bullet points, bold text, italics, images, and links where appropriate.
- Only use image links from the menu data, do not make up image URLs.
- When using images in answers, use tables if you are showing multiple images in a list, to make the layout cleaner. Otherwise, try using a single image at the bottom of your answer.
`;

const titleSystemPrompt = `Create a title for this chat session, based on the user question. The title should be less than 32 characters. Do NOT use double-quotes. The title should be concise, descriptive, and catchy. Respond with only the title, no other text.`;

export async function postChats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const azureOpenAiEndpoint = process.env.AZURE_OPENAI_API_ENDPOINT;
  const burgerMcpUrl = process.env.BURGER_MCP_URL ?? 'http://localhost:3000/mcp';

  try {
    const requestBody = (await request.json()) as AIChatCompletionRequest;
    const { messages, context: chatContext } = requestBody;

    const userId = await getInternalUserId(request, requestBody);
    if (!userId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Invalid or missing userId in the request',
        },
      };
    }

    if (messages?.length === 0 || !messages.at(-1)?.content) {
      return {
        status: 400,
        jsonBody: {
          error: 'Invalid or missing messages in the request body',
        },
      };
    }

    const sessionId = ((chatContext as any)?.sessionId as string) || randomUUID();
    context.log(`userId: ${userId}, sessionId: ${sessionId}`);

    if (!azureOpenAiEndpoint || !burgerMcpUrl) {
      const errorMessage = 'Missing required environment variables: AZURE_OPENAI_API_ENDPOINT or BURGER_MCP_URL';
      context.error(errorMessage);
      return {
        status: 500,
        jsonBody: {
          error: errorMessage,
        },
      };
    }

    const model = new ChatOpenAI({
      configuration: { baseURL: azureOpenAiEndpoint },
      modelName: process.env.AZURE_OPENAI_MODEL ?? 'gpt-5-mini',
      streaming: true,
      useResponsesApi: true,
      apiKey: getAzureOpenAiTokenProvider(),
    });
    const chatHistory = new AzureCosmsosDBNoSQLChatMessageHistory({
      sessionId,
      userId,
      credentials: getCredentials(),
      containerName: 'history',
      databaseName: 'historyDB',
    });

    const client = new Client({
      name: 'burger-mcp-client',
      version: '1.0.0',
    });
    context.log(`Connecting to Burger MCP server at ${burgerMcpUrl}`);
    const transport = new StreamableHTTPClientTransport(new URL(burgerMcpUrl));
    await client.connect(transport);

    const tools = await loadMcpTools('burger', client);
    context.log(`Loaded ${tools.length} tools from Burger MCP server`);

    const agent = createAgent({
      model,
      tools,
      systemPrompt: agentSystemPrompt,
    });

    const question = messages.at(-1)!.content;
    const previousMessages = await chatHistory.getMessages();
    context.log(`Previous messages in history: ${previousMessages.length}`);

    // Start the agent and stream the response events
    const responseStream = agent.streamEvents(
      {
        messages: [['human', `userId: ${userId}`], ...previousMessages, ['human', question]],
      },
      {
        configurable: { sessionId },
        version: 'v2',
      },
    );

    // Create a short title for this chat session
    const generateSessionTitle = async () => {
      const { title } = await chatHistory.getContext();
      if (!title) {
        const response = await model.invoke([
          ['system', titleSystemPrompt],
          ['human', question],
        ]);
        context.log(`Title for session: ${response.text}`);
        chatHistory.setContext({ title: response.text });
      }
    };

    // We don't await this yet, to allow parallel execution.
    // We'll await it later, after the response is fully sent.
    const sessionTitlePromise = generateSessionTitle();

    // Update chat history when the response is complete
    const onResponseComplete = async (content: string) => {
      try {
        if (content) {
          // When no content is generated, do not update the history as it's likely an error
          await chatHistory.addMessage(new HumanMessage(question));
          await chatHistory.addMessage(new AIMessage(content));
          context.log('Chat history updated successfully');

          // Ensure the session title has finished generating
          await sessionTitlePromise;
        }

        // Close MCP client connection
        await client.close();
      } catch (error) {
        context.error('Error after response completion:', error);
      }
    };

    const jsonStream = Readable.from(createJsonStream(responseStream, sessionId, onResponseComplete));

    return {
      headers: {
        // This content type is needed for streaming responses
        // when using a SWA linked backend API
        'Content-Type': 'text/event-stream',
        'Transfer-Encoding': 'chunked',
      },
      body: jsonStream,
    };
  } catch (_error: unknown) {
    const error = _error as Error;
    context.error(`Error when processing chat-post request: ${error.message}`);

    return {
      status: 500,
      jsonBody: {
        error: 'Internal server error while processing the request',
      },
    };
  }
}

// Transform the response chunks into a JSON stream
async function* createJsonStream(
  chunks: AsyncIterable<StreamEvent>,
  sessionId: string,
  onComplete: (responseContent: string) => Promise<void>,
) {
  for await (const chunk of chunks) {
    const { data } = chunk;
    let responseChunk: AIChatCompletionDelta | undefined;

    if (chunk.event === 'on_chat_model_end' && data.output?.content.length > 0) {
      // End of our agentic chain
      const content = data?.output.content[0].text ?? data.output.content ?? '';
      await onComplete(content);
    } else if (chunk.event === 'on_chat_model_stream' && data.chunk.content.length > 0) {
      // Streaming response from the LLM
      responseChunk = {
        delta: {
          content: data.chunk.content[0].text ?? data.chunk.content,
          role: 'assistant',
        },
      };
    } else if (chunk.event === 'on_chat_model_end') {
      // Intermediate LLM response (no content)
      responseChunk = {
        delta: {
          context: {
            intermediateSteps: [
              {
                type: 'llm',
                name: chunk.name,
                input: data.input ? JSON.stringify(data.input) : undefined,
                output:
                  data?.output.content.length > 0
                    ? JSON.stringify(data?.output.content)
                    : JSON.stringify(data?.output.tool_calls),
              },
            ],
          },
        },
      };
    } else if (chunk.event === 'on_tool_end') {
      // Tool call completed
      responseChunk = {
        delta: {
          context: {
            intermediateSteps: [
              {
                type: 'tool',
                name: chunk.name,
                input: data?.input?.input ?? undefined,
                output: data?.output.content ?? undefined,
              },
            ],
          },
        },
      };
    } else if (chunk.event === 'on_chat_model_start') {
      // Start of a new LLM call
      responseChunk = {
        delta: {
          context: {
            currentStep: {
              type: 'llm',
              name: chunk.name,
              input: data?.input ?? undefined,
            },
          },
        },
        context: { sessionId },
      };
    } else if (chunk.event === 'on_tool_start') {
      // Start of a new tool call
      responseChunk = {
        delta: {
          context: {
            currentStep: {
              type: 'tool',
              name: chunk.name,
              input: data?.input?.input ? JSON.stringify(data.input?.input) : undefined,
            },
          },
        },
      };
    }

    if (!responseChunk) {
      continue;
    }

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
