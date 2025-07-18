import { AzureChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createToolCallingAgent } from 'langchain/agents';
import { AgentExecutor } from 'langchain/agents';
import { loadMcpTools } from '@langchain/mcp-adapters';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getAzureOpenAiTokenProvider } from './src/auth.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '../../.env') });

const agentSystemPrompt = `
# Role
You an expert assistant that helps users with managing burger orders. Use the provided tools to get the information you need and perform actions on behalf of the user.
Only answer to requests that are related to burger orders and the menu. If the user asks for something else, politely inform them that you can only assist with burger orders.

# Task
Help the user with their request, ask any clarifying questions if needed.

# Instructions
- Always use the tools provided to get the information requested or perform any actions
- If you get any errors when trying to use a tool that does not seem related to missing parameters, try again
- If you cannot get the information needed to answer the user's question or perform the specified action, inform the user that you are unable to do so. Never make up information.
- The get_burger tool can help you get informations about the burgers
- Creating or cancelling an order requires a \`userId\`: if not provided, ask the user to provide it or to run the CLI with the \`--userId\` option.
`;

const question = 'show me the burger menu';

export async function run() {
  const azureOpenAiEndpoint = process.env.AZURE_OPENAI_API_ENDPOINT;
  const burgerMcpEndpoint = process.env.BURGER_MCP_URL ?? 'http://localhost:3000/mcp';

  try {
    let model: BaseChatModel;

    if (!azureOpenAiEndpoint || !burgerMcpEndpoint) {
      const errorMessage = 'Missing required environment variables: AZURE_OPENAI_API_ENDPOINT or BURGER_MCP_URL';
      console.error(errorMessage);
      return {
        status: 500,
        jsonBody: {
          error: errorMessage,
        },
      };
    }

    const azureADTokenProvider = getAzureOpenAiTokenProvider();

    model = new AzureChatOpenAI({
      // Controls randomness. 0 = deterministic, 1 = maximum randomness
      temperature: 0.3,
      azureADTokenProvider,
    });

    const client = new Client({
      name: 'burger-mcp',
      version: '1.0.0',
    });
    const transport = new StreamableHTTPClientTransport(new URL(burgerMcpEndpoint));
    await client.connect(transport);
    console.log(`Connected to Burger MCP server at ${burgerMcpEndpoint}`);

    const tools = await loadMcpTools('burger', client);
    console.log(`Loaded ${tools.length} tools from Burger MCP server`);

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', agentSystemPrompt],
      ['placeholder', '{chat_history}'],
      ['human', '{input}'],
      ['placeholder', '{agent_scratchpad}'],
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
    });

    const response = await agentExecutor.invoke({ input: question });

    console.log('Intermediate steps:', JSON.stringify(response.intermediateSteps, null, 2));
    console.log('Final answer:', response.output);
  } catch (_error: unknown) {
    const error = _error as Error;
    console.error(`Error when processing chat-post request: ${error.message}`);
  }
}

run();
