#!/usr/bin/env bash
##############################################################################
# Usage: ./create-packages.sh
# Creates packages for skippable sections of the workshop
##############################################################################

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

target_folder=dist

rm -rf "$target_folder"
mkdir -p "$target_folder"

copyFolder() {
  local src="$1"
  local dest="$target_folder/${2:-}"
  find "$src" -type d -not -path '*node_modules*' -not -path '*/.git' -not -path '*.git/*' -not -path '*/dist' -not -path '*/.azurite' -not -path '*dist/*' -not -path '*/lib' -not -path '*lib/*' -exec mkdir -p '{}' "$dest/{}" ';'
  find "$src" -type f -not -path '*node_modules*' -not -path '*.git/*' -not -path '*dist/*' -not -path '.azurite/*' -not -path '*lib/*' -not -path '*/.DS_Store' -exec cp -r '{}' "$dest/{}" ';'
}

makeArchive() {
  local src="$1"
  local name="${2:-$src}"
  local archive="$name.tar.gz"
  local cwd="${3:-}"
  echo "Creating $archive..."
  if [[ -n "$cwd" ]]; then
    pushd "$target_folder/$cwd" >/dev/null
    tar -czvf "../$archive" "$src"
    popd
    rm -rf "$target_folder/${cwd:?}"
  else
    pushd "$target_folder/$cwd" >/dev/null
    tar -czvf "$archive" "$src"
    popd
    rm -rf "$target_folder/${src:?}"
  fi
}

writeFiles() {
  # Overwrite files for the complete solution
  local dest="$target_folder/${1:-}"

  echo -e "# yaml-language-server: \$schema=https://raw.githubusercontent.com/Azure/azure-dev/main/schemas/v1.0/azure.yaml.json

name: mcp-agent-langchainjs
metadata:
  template: mcp-agent-langchainjs@1.0.0

services:
  burger-api:
    project: ./packages/burger-api
    language: ts
    host: function

  burger-mcp:
    project: ./packages/burger-mcp
    language: ts
    host: function

  agent-api:
    project: ./packages/agent-api
    language: ts
    host: function

  agent-webapp:
    project: ./packages/agent-webapp
    dist: dist
    language: ts
    host: staticwebapp

hooks:
  postprovision:
    run: azd env get-values > .env
" > azure.yaml

  echo -e "##################################################################
# VS Code with REST Client extension is needed to use this file.
# Download at: https://aka.ms/vscode/rest-client
##################################################################

@api_host = http://localhost:7072

### Chat with the bot
POST {{api_host}}/api/chats/stream
Content-Type: application/json

{
  \"messages\": [
    {
      \"content\": \"Do you have spicy burgers?\",
      \"role\": \"user\"
    }
  ]
}

" > packages/agent-api/api.http

  echo -e "import { Readable } from 'node:stream';
import { HttpRequest, InvocationContext, HttpResponseInit, app } from '@azure/functions';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { ChatOpenAI } from '@langchain/openai';
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { StreamEvent } from '@langchain/core/tracers/log_stream';
import { createAgent, AIMessage, HumanMessage } from 'langchain';
import { type AIChatCompletionRequest, type AIChatCompletionDelta } from '../models.js';

const agentSystemPrompt = \`## Role
You an expert assistant that helps users with managing burger orders. Use the provided tools to get the information you need and perform actions on behalf of the user.
Only answer to requests that are related to burger orders and the menu. If the user asks for something else, politely inform them that you can only assist with burger orders.
Be conversational and friendly, like a real person would be, but keep your answers concise and to the point.

## Context
The restaurant is called Contoso Burgers. Contoso Burgets always provides french fries and a fountain drink with every burger order, so there's no need to add them to orders.

## Task
1. Help the user with their request, ask any clarifying questions if needed.
2. ALWAYS generate 3 very brief follow-up questions that the user would likely ask next, as if you were the user.
Enclose the follow-up questions in double angle brackets. Example:
<<Do you have vegan options?>>
<<How can I cancel my order?>>
<<What are the available sauces?>>
Make sure the last question ends with \">>\", and phrase the questions as if you were the user, not the assistant.

## Instructions
- Always use the tools provided to get the information requested or perform any actions
- If you get any errors when trying to use a tool that does not seem related to missing parameters, try again
- If you cannot get the information needed to answer the user's question or perform the specified action, inform the user that you are unable to do so. Never make up information.
- The get_burger tool can help you get informations about the burgers
- Creating or cancelling an order requires the userId, which is provided in the request context. Never ask the user for it or confirm it in your responses.
- Use GFM markdown formatting in your responses, to make your answers easy to read and visually appealing. You can use tables, headings, bullet points, bold text, italics, images, and links where appropriate.
- Only use image links from the menu data, do not make up image URLs.
- When using images in answers, use tables if you are showing multiple images in a list, to make the layout cleaner. Otherwise, try using a single image at the bottom of your answer.
\`;

export async function postChats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const azureOpenAiEndpoint = process.env.AZURE_OPENAI_API_ENDPOINT;
  const burgerMcpUrl = process.env.BURGER_MCP_URL ?? 'http://localhost:3000/mcp';

  try {
    const requestBody = (await request.json()) as AIChatCompletionRequest;
    const { messages } = requestBody;

    const userId = process.env.USER_ID ?? requestBody?.context?.userId;
    if (!userId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Invalid or missing userId in the environment variables',
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

    // AI agent implmenentation
    const model = new ChatOpenAI({
      configuration: { baseURL: azureOpenAiEndpoint },
      modelName: process.env.AZURE_OPENAI_MODEL ?? 'gpt-5-mini',
      streaming: true,
      useResponsesApi: true,
      apiKey: getAzureOpenAiTokenProvider(),
    });

    context.log(\`Connecting to Burger MCP server at \${burgerMcpUrl}\`);
    const client = new MultiServerMCPClient({
      burger: {
        transport: 'http',
        url: burgerMcpUrl,
      },
    });

    const tools = await client.getTools();
    context.log(\`Loaded \${tools.length} tools from Burger MCP server\`);

    const agent = createAgent({
      model,
      tools,
      systemPrompt: agentSystemPrompt,
    });

    const lcMessages = messages.map((m) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
    );

    // Start the agent and stream the response events
    const responseStream = agent.streamEvents(
      {
        messages: [
          new HumanMessage(\`userId: \${userId}\`),
          ...lcMessages],
      },
      { version: 'v2' },
    );

    // Convert the LangChain stream into a Readable stream of JSON chunks
    const jsonStream = Readable.from(createJsonStream(responseStream));

    return {
      headers: {
        // This content type is needed for streaming responses
        // from an Azure Static Web Apps linked backend API
        'Content-Type': 'text/event-stream',
        'Transfer-Encoding': 'chunked',
      },
      body: jsonStream,
    };

  } catch (_error: unknown) {
    const error = _error as Error;
    context.error(\`Error when processing chat-post request: \${error.message}\`);

    return {
      status: 500,
      jsonBody: {
        error: 'Internal server error while processing the request',
      },
    };
  }
}

function getAzureOpenAiTokenProvider() {
  // Automatically find and use the current user identity
  const credentials = new DefaultAzureCredential();

  // Set up token provider
  const getToken = getBearerTokenProvider(credentials, 'https://cognitiveservices.azure.com/.default');
  return async () => {
    try {
      return await getToken();
    } catch {
      // When using Ollama or an external OpenAI proxy,
      // Azure identity is not supported, so we use a dummy key instead.
      console.warn('Failed to get Azure OpenAI token, using dummy key');
      return '__dummy';
    }
  };
}

// Transform the response chunks into a JSON stream
async function* createJsonStream(chunks: AsyncIterable<StreamEvent>) {
  for await (const chunk of chunks) {
    const { data } = chunk;
    let responseChunk: AIChatCompletionDelta | undefined;

    if (chunk.event === 'on_chat_model_stream' && data.chunk.content.length > 0) {
      // LLM is streaming the final response
      responseChunk = {
        delta: {
          content: data.chunk.content[0].text ?? data.chunk.content,
          role: 'assistant',
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
" > packages/agent-api/src/functions/chats-post.ts

  echo -e "<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />
    <meta name=\"description\" content=\"Contoso Burgers AI Agent\" />
    <link rel=\"icon\" type=\"image/png\" href=\"/favicon.png\" />
    <title>Contoso Burgers AI Agent</title>
    <link rel=\"stylesheet\" href=\"/src/styles.css\" />
  </head>
  <body>
    <nav>
      <img src=\"/favicon.png\" alt=\"\" />
      Contoso Burgers AI Agent
      <div class=\"spacer\"></div>
    </nav>
    <main>
      <azc-chat id=\"chat\"></azc-chat>
    </main>
    <script type=\"module\" src=\"/src/index.ts\"></script>
  </body>
</html>
" > packages/agent-webapp/index.html
}

##############################################################################
# Complete solution
##############################################################################

echo "Creating solution package"
copyFolder . solution
rm -rf "$target_folder/solution/.azure"
rm -rf "$target_folder/solution/.genaiscript"
rm -rf "$target_folder/solution/.env"
rm -rf "$target_folder/solution/*.env"
rm -rf "$target_folder/solution/env.js"
rm -rf "$target_folder/solution/*.ipynb.md"
rm -rf "$target_folder/solution/docs"
rm -rf "$target_folder/solution/.github/*.md"
rm -rf "$target_folder/solution/.github/agents"
rm -rf "$target_folder/solution/.github/instructions/cli*.md"
rm -rf "$target_folder/solution/.github/instructions/genaiscript*.md"
rm -rf "$target_folder/solution/.github/instructions/script*.md"
rm -rf "$target_folder/solution/.github/prompts"
rm -rf "$target_folder/solution/.github/scripts"
rm -rf "$target_folder/solution/.github/workflows/docs.yml"
rm -rf "$target_folder/solution/.github/workflows/packages.yml"
rm -rf "$target_folder/solution/.github/workflows/stale-bot.yml"
rm -rf "$target_folder/solution/.github/workflows/build-test.yml"
rm -rf "$target_folder/solution/.github/workflows/validate-infra.yml"
rm -rf "$target_folder/solution/TODO*"
rm -rf "$target_folder/solution/packages/agent-cli"
rm -rf "$target_folder/solution/packages/burger-data"
rm -rf "$target_folder/solution/packages/burger-webapp"
rm -rf "$target_folder/solution/packages/burger-mcp/.env.example"
rm -rf "$target_folder/solution/packages/agent-api/src/chat-get.ts"
rm -rf "$target_folder/solution/packages/agent-api/src/chat-delete.ts"
perl -pi -e 's/"run": "npm run swa:start"/"run": "npm run dev"/g' "$target_folder/solution/packages/agent-webapp/swa-cli.config.json"

writeFiles solution
makeArchive . solution solution

##############################################################################
# MCP server tools
##############################################################################

echo "Creating mcp-server-tools package..."
mkdir -p "$target_folder/packages/burger-mcp/src"
cp -R packages/burger-mcp/src/mcp.ts "$target_folder/packages/burger-mcp/src/mcp.ts"
makeArchive packages burger-mcp-tools

##############################################################################
# Agent API
##############################################################################

echo "Creating agent-api package..."
copyFolder packages/agent-api
writeFiles agent-api
rm -rf "$target_folder/packages/agent-webapp"
rm -rf "$target_folder/azure.yaml"
makeArchive packages agent-api

##############################################################################
# Agent webapp
##############################################################################

echo "Creating agent-webapp package..."
copyFolder packages/agent-webapp
writeFiles agent-webapp
perl -pi -e 's/"run": "npm run swa:start"/"run": "npm run dev"/g' "$target_folder/packages/agent-webapp/swa-cli.config.json"
rm -rf "$target_folder/packages/agent-api"
rm -rf "$target_folder/azure.yaml"
makeArchive packages agent-webapp

##############################################################################
# Deployment (CI/CD)
##############################################################################

echo "Creating CI/CD package..."
mkdir -p "$target_folder/ci-cd/.github/workflows"
cp .github/workflows/deploy.yml "$target_folder/ci-cd/.github/workflows/deploy.yml"
makeArchive . ci-cd ci-cd
