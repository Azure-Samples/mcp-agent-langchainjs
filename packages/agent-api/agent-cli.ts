#!/usr/bin/env node

import { AzureChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createToolCallingAgent } from 'langchain/agents';
import { AgentExecutor } from 'langchain/agents';
import { loadMcpTools } from '@langchain/mcp-adapters';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { getAzureOpenAiTokenProvider } from './src/auth.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '../../.env'), quiet: true });

const agentSystemPrompt = `
## Role
You an expert assistant that helps users with managing burger orders. Use the provided tools to get the information you need and perform actions on behalf of the user.
Only answer to requests that are related to burger orders and the menu. If the user asks for something else, politely inform them that you can only assist with burger orders.

## Task
Help the user with their request, ask any clarifying questions if needed.

## Instructions
- Always use the tools provided to get the information requested or perform any actions
- If you get any errors when trying to use a tool that does not seem related to missing parameters, try again
- If you cannot get the information needed to answer the user's question or perform the specified action, inform the user that you are unable to do so. Never make up information.
- The get_burger tool can help you get informations about the burgers
- Creating or cancelling an order requires a \`userId\`: if not provided, ask the user to provide it or to run the CLI with the \`--userId\` option.

## Output
Your response will be printed to a terminal. Do not use markdown formatting or any other special formatting. Just provide the plain text response.
`;

interface CliArgs {
  question: string;
  userId?: string;
  isNew: boolean;
}

interface SessionData {
  history: Array<{ type: 'human' | 'ai'; content: string }>;
  userId?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('Usage: agent-cli <question> [--userId <userId>] [--new]');
    console.log('  question: Your question about burger orders');
    console.log('  --userId: Optional user ID (needed for some tasks)');
    console.log('  --new: Start a new session');
    process.exit(0);
  }

  const questionParts: string[] = [];
  let userId: string | undefined;
  let isNew = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--userId') {
      userId = args[i + 1];
      i++;
    } else if (arg === '--new') {
      isNew = true;
    } else {
      questionParts.push(arg);
    }
  }

  const question = questionParts.join(' ');

  if (!question) {
    console.error('Error: Question is required');
    process.exit(1);
  }

  return { question, userId, isNew };
}

async function getSessionPath(): Promise<string> {
  const userDataDir = path.join(os.homedir(), '.burger-agent-cli');
  await fs.mkdir(userDataDir, { recursive: true });
  return path.join(userDataDir, 'burger-agent-cli.json');
}

async function loadSession(): Promise<SessionData> {
  try {
    const sessionPath = await getSessionPath();
    const content = await fs.readFile(sessionPath, 'utf-8');
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
  return history.map(msg =>
    msg.type === 'human'
      ? new HumanMessage(msg.content)
      : new AIMessage(msg.content)
  );
}

export async function run() {
  const { question, userId, isNew } = parseArgs();
  const azureOpenAiEndpoint = process.env.AZURE_OPENAI_API_ENDPOINT;
  const burgerMcpEndpoint = process.env.BURGER_MCP_URL ?? 'http://localhost:3000/mcp';

  try {
    let model: BaseChatModel;

    if (!azureOpenAiEndpoint || !burgerMcpEndpoint) {
      const errorMessage = 'Missing required environment variables: AZURE_OPENAI_API_ENDPOINT or BURGER_MCP_URL';
      console.error(errorMessage);
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

    const azureADTokenProvider = getAzureOpenAiTokenProvider();

    model = new AzureChatOpenAI({
      temperature: 0.3,
      azureADTokenProvider,
      azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
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

    console.log(`Thinking...`);

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', agentSystemPrompt + (session.userId ? `\n\nUser ID: ${session.userId}` : '')],
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
      returnIntermediateSteps: false,
    });

    const chatHistory = convertHistoryToMessages(session.history);

    const response = await agentExecutor.invoke({
      input: question,
      chat_history: chatHistory
    });

    console.log('----------\n' + response.output);

    session.history.push({ type: 'human', content: question });
    session.history.push({ type: 'ai', content: response.output });

    await saveSession(session);

    console.log('----------\nDone.');

  } catch (_error: unknown) {
    const error = _error as Error;
    console.error(`Error when processing request: ${error.message}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('agent-cli.ts') || process.argv[1].endsWith('agent-cli.js')) {
  run();
}
