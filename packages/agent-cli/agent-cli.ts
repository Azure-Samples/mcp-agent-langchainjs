import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { createAgent, BaseMessage, HumanMessage, AIMessage } from 'langchain';
import { ChatOpenAI } from '@langchain/openai';
import { loadMcpTools } from '@langchain/mcp-adapters';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '../../.env'), quiet: true });

const agentSystemPrompt = `
## Role
You an expert assistant that helps users with managing burger orders. Use the provided tools to get the information you need and perform actions on behalf of the user.
Only answer to requests that are related to burger orders and the menu. If the user asks for something else, politely inform them that you can only assist with burger orders.
You are invoked from a command line interface.

## Task
Help the user with their request, ask any clarifying questions if needed.

## Instructions
- Always use the tools provided to get the information requested or perform any actions
- If you get any errors when trying to use a tool that does not seem related to missing parameters, try again
- If you cannot get the information needed to answer the user's question or perform the specified action, inform the user that you are unable to do so. Never make up information.
- The get_burger tool can help you get informations about the burgers
- Creating or cancelling an order requires a \`userId\`: if not provided, ask the user to provide it or run the CLI with the \`--userId\` option (make sure you mention this). To get its user ID, the user must connect to ${process.env.AGENT_WEBAPP_URL ?? 'http://localhost:4280 (make sure that agent-webapp is running)'}.

## Output
Your response will be printed to a terminal. Do not use markdown formatting or any other special formatting. Just provide the plain text response.
`;

interface CliArgs {
  question: string;
  userId?: string;
  isNew: boolean;
  verbose: boolean;
  local: boolean;
}

interface SessionData {
  history: Array<{ type: 'human' | 'ai'; content: string }>;
  userId?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('Usage: agent-cli <question> [--userId <userId>] [--new] [--verbose] [--local]');
    console.log('  question: Your question about burger orders');
    console.log('  --userId: Optional user ID (needed for some tasks)');
    console.log('  --new: Start a new session');
    console.log('  --verbose: Enable verbose mode to show intermediate steps');
    console.log('  --local: Force connection to localhost MCP server');
    process.exit(0);
  }

  const questionParts: string[] = [];
  let userId: string | undefined;
  let isNew = false;
  let verbose = false;
  let local = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--userId') {
      userId = args[i + 1];
      i++;
    } else if (arg === '--new') {
      isNew = true;
    } else if (arg === '--verbose') {
      verbose = true;
    } else if (arg === '--local') {
      local = true;
    } else {
      questionParts.push(arg);
    }
  }

  const question = questionParts.join(' ');

  if (!question) {
    console.error('Error: Question is required');
    process.exit(1);
  }

  return { question, userId, isNew, verbose, local };
}

async function getSessionPath(): Promise<string> {
  const userDataDirectory = path.join(os.homedir(), '.burger-agent-cli');
  await fs.mkdir(userDataDirectory, { recursive: true });
  return path.join(userDataDirectory, 'burger-agent-cli.json');
}

async function loadSession(): Promise<SessionData> {
  try {
    const sessionPath = await getSessionPath();
    const content = await fs.readFile(sessionPath, 'utf8');
    return JSON.parse(content);
  } catch {
    return { history: [] };
  }
}

async function saveSession(session: SessionData): Promise<void> {
  try {
    const sessionPath = await getSessionPath();
    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
}

function convertHistoryToMessages(history: SessionData['history']): BaseMessage[] {
  return history.map((message) =>
    message.type === 'human' ? new HumanMessage(message.content) : new AIMessage(message.content),
  );
}

export async function run() {
  const { question, userId, isNew, verbose, local } = parseArgs();
  const azureOpenAiEndpoint = process.env.AZURE_OPENAI_API_ENDPOINT;
  const localMcpEndpoint = 'http://localhost:3000/mcp';
  const burgerMcpEndpoint = local ? localMcpEndpoint : (process.env.BURGER_MCP_URL ?? localMcpEndpoint);

  let client: Client | undefined;

  try {
    if (!azureOpenAiEndpoint || !burgerMcpEndpoint) {
      const errorMessage = 'Missing required environment variables: AZURE_OPENAI_API_ENDPOINT or BURGER_MCP_URL';
      console.error(errorMessage);
      process.exitCode = 1;
      return;
    }

    let session: SessionData;
    if (isNew) {
      session = { history: [], userId };
    } else {
      session = await loadSession();
      if (userId && session.userId !== userId) {
        session.userId = userId;
      }
    }

    const getToken = getBearerTokenProvider(
      new DefaultAzureCredential(),
      'https://cognitiveservices.azure.com/.default',
    );
    const model = new ChatOpenAI({
      configuration: {
        baseURL: azureOpenAiEndpoint,
        async fetch(url, init = {}) {
          const token = await getToken();
          const headers = new Headers(init.headers);
          headers.set('Authorization', `Bearer ${token}`);
          return fetch(url, { ...init, headers });
        },
      },
      modelName: process.env.AZURE_OPENAI_MODEL ?? 'gpt-5-mini',
      streaming: true,
      useResponsesApi: true,
      apiKey: 'not_used',
    });

    client = new Client({
      name: 'burger-mcp',
      version: '1.0.0',
    });
    const transport = new StreamableHTTPClientTransport(new URL(burgerMcpEndpoint));
    await client.connect(transport);
    console.log(`Connected to Burger MCP server at ${burgerMcpEndpoint}`);

    const tools = await loadMcpTools('burger', client);
    console.log(`Loaded ${tools.length} tools from Burger MCP server`);

    const agent = createAgent({
      model,
      tools,
      systemPrompt: agentSystemPrompt + (session.userId ? `\n\nUser ID: ${session.userId}` : ''),
    });

    const chatHistory = convertHistoryToMessages(session.history);

    console.log('Thinking...\n');

    const eventStream = agent.streamEvents(
      {
        messages: [...chatHistory, new HumanMessage(question)],
      },
      { version: 'v2' },
    );

    let step = 0;
    for await (const event of eventStream) {
      const { data } = event;
      if (event.event === 'on_chat_model_stream' && data?.chunk?.content?.length > 0) {
        const { text } = data.chunk.content[0];
        process.stdout.write(text);
      } else if (event.event === 'on_tool_end') {
        if (verbose) {
          if (step === 0) {
            console.log('--------------------');
            console.log('Intermediate steps');
            console.log('--------------------');
          }

          step++;
          console.log(`*** Step ${step} ***`);
          console.log(`Tool: ${event.name}`);
          if (data?.input?.input) {
            console.log(`Input:`, data.input.input);
          }

          if (data?.output?.content) {
            console.log(`Output:`, data.output.content);
          }

          console.log('--------------------\n');
        }
      } else if (
        event.event === 'on_chain_end' &&
        event.name === 'RunnableSequence' &&
        data.output?.content.length > 0
      ) {
        const finalContent = data.output.content[0].text;
        if (finalContent) {
          session.history.push(
            { type: 'human', content: question },
            { type: 'ai', content: data.output.content[0].text },
          );
          await saveSession(session);
        }
      }
    }
  } catch (_error: unknown) {
    const error = _error as Error;
    console.error(`Error when processing request: ${error.message}`);
    process.exitCode = 1;
  }

  if (client) {
    try {
      await client.close();
    } catch (error) {
      console.error('Error closing MCP client:', error);
    }
  }

  process.exitCode = 0;
}
