## Agent API

With our MCP server up and running, it's time to build our AI agent using LangChain.js. We'll also create an API endpoint that our frontend can call to chat with the agent.

### About LangChain.js

There are many frameworks available to build AI agents, but for this workshop we'll use [LangChain.js](https://docs.langchain.com/oss/javascript/langchain/overview). It's one of the most popular JS frameworks for building applications with LLMs, with a huge community of developers. Since its v1.0 release, it's now an agent-first framework making it a perfect fit for our use case.

The benefits of using LangChain.js are numerous:
- It provides a simple and consistent API to interact with different LLM providers, allowing to switch and try different models with minimal code changes.
- It has first-class support for building agents, while streaming all intermediate steps for creating dynamic UI experiences.
- It supports a wide range of tools and integrations, including MCP, vector databases, APIs, and more.
- The [LangGraph.js](https://docs.langchain.com/oss/javascript/langgraph/overview) companion library gives you full control over your agents behavior when needed, with support for multi-agents orchestration and advanced workflows.

### Introducting Azure Functions

We'll use [Azure Functions](https://learn.microsoft.com/azure/azure-functions/functions-overview?pivots=programming-language-javascript) to host the web API for ou Agent. Azure Functions is a serverless compute service that enables you to scale on-demand without having to manage infrastructure. It's a great fit for JS applications, and now even support hosting full Node.js applications, like our MCP server.

#### Creating the HTTP function

Let's bootstrap our chat API endpoint, that will be used to interact with our AI agent. Open the file `src/functions/chat-post.ts` and add this code:

```ts
import { HttpRequest, InvocationContext, HttpResponseInit, app } from '@azure/functions';
import { type AIChatCompletionRequest, type AIChatCompletionDelta } from '../models.js';

export async function postChats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {

  // TODO: implement chat endpoint

}

app.setup({ enableHttpStream: true });
app.http('chats-post', {
  route: 'chats/stream',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: postChats,
});
```

Here we're using the Azure Functions SDK to create an HTTP-triggered function. this bootstraping code is similar to what you would do with other frameworks like Express or Fastify:

1. We create the function that will implement the chat endpoint logic, named `postChats`.
2. We use the `app.http` method to define the HTTP endpoint, specifying the route, the supported HTTP methods, if the endpoint needs authentication (`anonymous` means that it's publicly available to any user), and the handler function.
3. As we're going to stream the Agent responses, we need to toggle a special option to enable HTTP streaming with `{ enableHttpStream: true }`.

You might have noticed in the imports that we already have defined some models that we'll use for our request and response:
- `AIChatCompletionRequest`: defines the shape of the request body that our endpoint will receive.
- `AIChatCompletionDelta`: defines the shape of the response chunks that our endpoint will stream back to the client.

These models correspond to the specifiction we saw earlier in the **Overview** section.

#### Completing the boilerplate

Before we can focus on the agent implementation let's get the boilerplate code out of the way. We'll add basic checks and error handling to our endpoint.

Replace the `postChats` function with this code:

```ts
export async function postChats(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const azureOpenAiEndpoint = process.env.AZURE_OPENAI_API_ENDPOINT;
  const burgerMcpUrl = process.env.BURGER_MCP_URL ?? 'http://localhost:3000/mcp';

  try {
    const requestBody = (await request.json()) as AIChatCompletionRequest;
    const { messages } = requestBody;

    const userId = process.env.USER_ID;
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

    // TODO: Implement the AI agent here

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
```

As you can see, we simply added validation for environment variables and the request input, and wrapped everything in a try/catch block to handle any unexpected errors.

### Implementing the AI agent

Now we can start coding our AI agent! Let's start by initializing our LLM model using LangChain.js. Add this import at the top of the file:

```ts
import { ChatOpenAI } from '@langchain/openai';
```

Then, inside the `postChats` function, add this code after the `// TODO: Implement the AI agent here` comment: 

```ts
    const model = new ChatOpenAI({
      configuration: { baseURL: azureOpenAiEndpoint },
      modelName: process.env.AZURE_OPENAI_MODEL ?? 'gpt-5-mini',
      streaming: true,
      useResponsesApi: true,
      apiKey: getAzureOpenAiTokenProvider(),
    });
```

<!-- TODO: test ollama responses api -->

#### Managing Azure credentials

Now we need to handle the authentication part and implement the `getAzureOpenAiTokenProvider` function.

To allow connecting to Azure OpenAI without having to manage secrets, we'll use the [Azure Identity SDK](https://learn.microsoft.com/javascript/api/overview/azure/identity-readme?view=azure-node-latest) to retrieve an access token using the current user identity.

Add this import at the top of the file:

```ts
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
```

Then add this at the bottom of the file:

```ts
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
```

This will use the current user identity to authenticate with Azure OpenAI. We don't need to provide any secrets, just use `az login` (or `azd auth login`) locally, and [managed identity](https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview) when deployed on Azure.

#### Connecting to the MCP server

The next step is to connect to our Burger MCP server and load the tools we need for our agent. Add this import at the top of the file:

```ts
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
```

Next, continue the code inside the `postChats` function after the model initialization:

```ts
    context.log(`Connecting to Burger MCP server at ${burgerMcpUrl}`);
    const client = new MultiServerMCPClient({
      burger: {
        transport: 'http',
        url: burgerMcpUrl,
      },
    });

    const tools = await client.getTools();
    context.log(`Loaded ${tools.length} tools from Burger MCP server`);
```

Here we're first creating an MCP client and connecting it to our Burger MCP server using HTTP. Note that the `MultiServerMCPClient` supports connecting to multiple MCP servers and mixing different transports if needeed. By default, it works with **stateless connections** and needs some additional configuration to support **stateful servers** (see the [LangChain.js MCP documentation](https://docs.langchain.com/oss/javascript/langchain/mcp) for more details).

After the connection is established, we use `getTools` to load all the tools exposed by the MCP server in a LangChain.js compatible format.

#### Creating the system prompt

The last thing we need to do before creating the agent is to define the system prompt that will set the context for our agent. Don't overlook this step, as this is the most important part of the agent behavior!

Add this code after the imports:

```ts
const agentSystemPrompt = `## Role
You an expert assistant that helps users with managing burger orders. Use the provided tools to get the information you need and perform actions on behalf of the user.
Only answer to requests that are related to burger orders and the menu. If the user asks for something else, politely inform them that you can only assist with burger orders.
Be conversational and friendly, like a real person would be, but keep your answers concise and to the point.

## Context
The restaurant is called Contoso Burgers. Contoso Burgets always provides french fries and a fountain drink with every burger order, so there's no need to add them to orders.

## Task
1. Help the user with their request, ask any clarifying questions if needed.

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
```

As you can see, this prompt is quite detailed. We'll break it down to understand the different parts:
- **Role**: we define the role of the agent, what it is supposed to do/not do and the tone it should use. Role-playing is a powerful technique to guide an LLM behavior, and has been shown to improve results significantly.

- **Context**: we provide additional context about the restaurant and its policies. This **grounds the agent** in the specific domain of our company, and provide the necessary background information and data (like the fact that fries and drinks are included with every order) that the burger API does not provide directly.

- **Task**: we define the main task of the agent, which is to help the user with their requests. This can be a multiple-step task, here we just keep it simple.

- **Instructions**: we provide a set of instructions to guide the agent behavior, can clarify, fine-tune, and constrain its actions. Some important instructions here are:
  * `Always use the provided tools to get information or perform actions`: this ensures that the agent relies on the tools we provided via MCP, and does not try to answer questions on its own. We also give it an example usage with the `get_burger` tool, and explicitly tell it to retry if it gets errors.
  * `If you cannot get the information needed...`: this is **a very important instruction to avoid hallucinations**, called an *escape hatch*. It tells the agent to inform the user if it cannot fulfill their request, instead of making up information.
  * `Creating or cancelling an order requires the userId...`: this instruction is specific to our use case, as we will provide the `userId` via the request context. This prevents the agent from asking for it, which might be confusing for the user.
  * We also provide detailed instructions on how to format the answers using markdown, including images. This kind of formatting can be tuned to fit your frontend needs.

<div class="tip" data-title="Tip">

> Crafting good prompts is an iterative process. You should test and tweak the prompt as you go, to get the best results for your specific use case. Instructions that work well for one domain may not be optimal for another, so don't hesitate to experiment! This is outside the scope of this workshop, but you can use tools like [Promptfoo](https://github.com/promptfoo/promptfoo) to help you evaluate your prompts and compare different versions.

</div>

When working with agents, the prompt crafting process is called *context engineering*, and it's a key skill to master when building AI applications. It's also a bit different than what we call *prompt engineering*: prompt engineering is more focused on **how** to write the prompt (formatting, structure, wording etc.), while context engineering is more about **what** to include in the prompt to provide the necessary context for the agent to perform its task effectively, without overloading it with unnecessary information.

#### Creating the agent

We have the LLM, the tools and the prompt: it's time to create the agent!

Add this import:

```ts
import { createAgent, AIMessage, HumanMessage } from 'langchain';
```

Then again, continue the code inside the `postChats` function after loading the tools:

```ts
    const agent = createAgent({
      model,
      tools,
      systemPrompt: agentSystemPrompt,
    });
```

Seems pretty straightforward, right? We just call the `createAgent` function, passing the model, the tools and the system prompt we created earlier.

While simple on the surface, this creates a *ReAct* (Reasoning + Acting) agent that decide which tools to use, and iteratively work towards solutions.

You have have the option to customize the agent behavior with **middlewares**, that can dynamically modify, extend or hook into the agent execution flow.

Middlewares can for example be used to:
- Add human-in-the-loop capabilities, to allow a human to review and approve tool calls before they are executed
- Add pre/post model and tool processing for context injection or validation, for security or compliance purposes
- Add dynamic control flows, to automatically retry failed tool calls, or branch the execution based on certain conditions

Our use case is simple enough that we don't need any middlewares, but you can read more about them in the [LangChain.js documentation](https://docs.langchain.com/oss/javascript/langchain/middleware/overview).

#### Generating the response

Before we can call the agent to generate the response, we need to convert the messages we received in the request to the format expected by LangChain.js. Add this code after the agent creation:

```ts
    const lcMessages = messages.map((m) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
    );
```

Now we can call the agent to generate the response. Add this code below:

```ts
    // Start the agent and stream the response events
    const responseStream = agent.streamEvents(
      {
        messages: [
          new HumanMessage(`userId: ${userId}`),
          ...lcMessages],
      },
      { version: 'v2' },
    );
```

<div class="info" data-title="note">

> LangChain.js supports different way of streaming the responses. Here we use the `streamEvents` method, which returns all the agents steps as series of events that you can filter and process as needed. There's also a `stream` method, which you can configure to receive specific updates. Using `streamEvents` gives us more flexibility and control over the response handling.

</div>

Let's complete the `postChats` function by returning the response stream to the client. Add this import at the top of the file:

```ts
import { Readable } from 'node:stream';
import { StreamEvent } from '@langchain/core/tracers/log_stream';
```

And complete the `postChats` function after the response stream creation:

```ts
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
```

The `Readable.from()` methods allows us to create a Node.js stream from an [async generator function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator). We also need to further process the response stream to convert it to a JSON format compatible with our frontend, so we call a helper function named `createJsonStream` that we'll implement next.

Finally, we return the HTTP response with the appropriate headers for streaming, and the body set to our JSON stream.

#### Filtering and formatting the event stream

Now it's time to implement the `createJsonStream` function. Add this code at the bottom of the file:

```ts
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
```

The event stream from LangChain.js contains different kinds of events, and not all of them relevant for our use case. They're sent as chunks that contain an `event` type and associated `data`.

Here we're catching and processing kinds of events from the response chunk:

1. **on_chat_model_stream**: this event is sent when the LLM is streaming tokens, ie the final response. We format it as a chat message delta.

2. **on_chat_model_start**: this event is sent when the agent starts a new LLM call. We format it as a context delta with the current step information.

3. **on_tool_start**: this event is sent when the agent starts a new tool call. We format it as a context delta with the current step information.

<div class="info" data-title="note">

> You may have notices the `async function*` syntax used to define the `createJsonStream` function.
> This is an [async generator function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/AsyncGenerator), which allows us to `yield` values asynchronously. The `yield` keyword allows for the function to return multiple values over time, building up a stream of data.

</div>

There are many more events that you can hook into, you can try adding a `console.log({ chunk });` at the beginning of the `for await` loop to see all the events being sent by the agent.

### Testing our API

Make sure your Burger MCP server is still running locally, then open a terminal and start the agent API with:

```bash
cd packages/agent-api
npm start
```

This will start the Azure Functions runtime and host our agent API locally at `http://localhost:7072`. You should see this in the terminal when it's ready:

![Azure Functions runtime started](./assets/functions-runtime-started.png)

#### Option 1: Using the REST Client extension

This is the easiest way to test our API. If you don't have it yet, install the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension for VS Code.

Open the file `packages/agent-api/api.http` file. Go to the "Chat with the agent" comment and hit the **Send Request** button below to test the API.

You can play a bit and edit the question to see how the agent behaves.

#### Option 2: using cURL

Open up a new terminal in VS Code, and run the following commands:
  
```bash
curl -N -sS -X POST "http://localhost:7072/api/chats/stream" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "content": "What is there on the menu?",
      "role": "user"
    }]
  }'
```

You can play a bit and change the question to see how the agent behaves.

### (Optional) Debugging your agent with traces

As you're playing with your agent, you might want to see more details about its internal workings, like which tools it called, what were the inputs and outputs, and so on. This is especially useful when you're trying to debug or improve your agent's behavior.

There are various ways to achieve this, but one of the most effective methods is to use tracing. We'll use [OpenTelemetry](https://opentelemetry.io), one of the most popular open-source observability frameworks, to instrument our agent and collect traces. LangChain.js does not have a built-in support for OpenTelemetry, but the community package [@arizeai/openinference-instrumentation-langchain](https://www.npmjs.com/package/@arizeai/openinference-instrumentation-langchain) fills this gap nicely.

We've already set up OpenTelemetry in our project, so all we need to do is enable the LangChain.js instrumentation in our agent API. You can open the file `packages/agent-api/src/tracing.ts` to have a quick look at how we configured it.

When running the server locally, we detect if there's an OpenTelemetry collector running at `http://localhost:4318`, and send the traces there.

#### OpenTelemetry collector in AI Toolkit

The [AI Toolkit for Visual Studio Code](https://code.visualstudio.com/docs/intelligentapps/overview) extension provides a great way to visualize and explore OpenTelemetry traces directly within VS Code. If you don't have it yet, install this extension by following the link.

<div class="important" data-title="Important">

> The tracing features in AI Toolkit are currently only available when running VS Code locally on your machine. They are not supported when using GitHub Codespaces.

</div>

Select the AI Toolkit icon in the VS Code sidebar, then go to the **Tracing** tool, located under the **Agent and Workflow Tools** section:

![Screenshot of AI Toolkit tracing tool in VS Code](./assets/ai-toolkit-tracing.png)

Click on the **Start Collector** button to launch a local OpenTelemetry collector, then make some requests to your agent API using one of the methods described earlier.

You should start seeing traces appearing in table:

![Screenshot of agent traces in AI Toolkit](./assets/ai-toolkit-traces.png)

Select the "LangGraph" trace to see the details of the agent execution, including the tool calls and LLM interactions. You can expand each span to see more details, like the inputs and outputs, and any errors that might have occurred.

![Screenshot of agent trace details](./assets/ai-toolkit-trace-details.png)
