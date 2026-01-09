## MCP server

We'll start by creating the MCP server. Its role is to expose the Burger API as MCP tools that can later be used by our LangChain.js agent.

### About the MCP SDK

To implement the MCP server, we'll use the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk), which provides the necessary tools to create MCP-compliant servers and clients. The MCP TypeScript SDK also needs [Zod](https://zod.dev) as a dependency to define and validate the data schemas used in MCP messages: it's used to ensure the typing safety of the data exchanged between the MCP server and its clients, as well as define the parameters shapes for the tools exposed by the MCP server.

<div class="tip" data-title="tip">

> The MCP SDK is available in many languages, so you can choose you favorite technology to implement and use MCP servers and clients. You can find the list of available SDKs on the [official MCP SDKs page](https://modelcontextprotocol.io/docs/sdk). It's also possible to mix and match different languages for the server and client, as all SDKs are compatible with each other.

</div>

[Express](https://expressjs.com) will be used to create the MCP server, as it's a lightweight and flexible web framework for Node.js directly supported by the MCP TypeScript SDK, but you can use any other web framework of your choice.

### MCP transports

MCP uses UTF-8 encoded JSON-RPC messages to communicate between clients and servers. There are two transport methods supported by MCP for sending and receiving these messages:

1. **stdio**: This method uses standard input and output streams for communication. It's typically used for local communication between processes on the same machine.
2. **Streamable HTTP**: This method uses HTTP streams for communication. It's suitable for remote communication over a network.

Note that it's also possible to implement custom transport methods if needed, but it will break compatibility with community-shared MCP clients and servers.

For our use case, we'll use the Streamable HTTP transport, as our LangChain.js agent will communicate with the MCP server over HTTP. If you're interested, there's an optional section at the end of this workshop that explains how to also support stdio transport in the MCP server.

### Initializing the MCP server

First, let's start by installing the required dependencies. Go to the `packages/burger-mcp` folder and run the following command to install the MCP SDK:

```bash
cd packages/burger-mcp
npm install @modelcontextprotocol/sdk zod
```

Open the `src/mcp.ts` file and add these imports at the top of the file:

```ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { burgerApiUrl } from './config.js';
```

Next, initialize the MCP server by adding the following code at the bottom of the `src/mcp.ts` file:

```ts
export function getMcpServer() {
  const server = new McpServer({
    name: 'burger-mcp',
    version: '1.0.0',
  });

  // Add tools here

  return server;
}
```

Here we simply create a new MCP server instance. The only two required parameters are the server name and version, but you can also provide additional metadata such as a description or website URL. You can explore the available options by check the `McpServer` type definition in your IDE: in VS Code, you can hover on `McpServer` to peek at its definition.

By creating a helper function that returns the MCP server instance, we can more easily reuse it later with different transports (HTTP and stdio).

### Adding burger API tools

The next step is to add tools to the MCP server that will expose the Burger API endpoints. Here we'll have each tool correspond to a specific API endpoint, but in more complex use-cases, a tool could also wrap multiple API calls or implement additional logic.

Since we want to expose multiple endpoints from the Burger API, let's first create a helper function to avoid repeating the same code for each tool. Add the following function after the `getMcpServer` function, to wrap the `fetch` call to the Burger API:

```ts
// Wraps standard fetch to include the base URL and handle errors
async function fetchBurgerApi(url: string, options: RequestInit = {}): Promise<Record<string, any>> {
  const fullUrl = new URL(url, burgerApiUrl).toString();
  console.error(`Fetching ${fullUrl}`);
  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Error fetching ${fullUrl}: ${response.statusText}`);
    }

    if (response.status === 204) {
      return { result: 'Operation completed successfully. No content returned.' };
    }

    return response.json();
  } catch (error: any) {
    console.error(`Error fetching ${fullUrl}:`, error);
    throw error;
  }
}
```

This function takes care of building the full URL, setting the required headers for JSON, and handling errors. It returns the response body as a an object, that we'll later format as an MCP response.

<div class="info" data-title="Note">

> If you look closely, you'll see that we're using `console.error` to log messages instead of `console.log`. This is because MCP servers use standard output (stdout) for sending MCP messages when using the **stdio** transport, so logging to stdout could interfere with the MCP communication. By using standard error (stderr) for logging, we ensure that our logs don't mix with the MCP messages.

</div>

#### Implementing our first tool

Next, inside the `getMcpServer` function, we can add our first tool to get the list of available burgers from the Burger API. Add the following code after the `// Add tools here` line:

```ts
  // Get the list of available burgers
  server.registerTool(
    'get_burgers',
    { description: 'Get a list of all burgers in the menu' },
    async () => {
      const burgers = await fetchBurgerApi('/api/burgers');
      return {
        structuredContent: { result: burgers },
        content: []
      };
    },
  );
```

And here we have registered our first tool! The `registerTool` method takes 3 parameters:

1. **The tool name:** this is how the tool will be identified by MCP clients, this must be unique within the server. Note that tool names must follow [specific rules](https://modelcontextprotocol.io/specification/latest/server/tools#tool-names).

2. **The tool config:** this object contains metadata about the tool, such as its description, input and output schemas, etc. **It's strongly recommended to always provided a description for each tool**, as it will help the LLM understand what the tool does and when to use it. You can optionally provide input and output schemas using Zod to define the expected parameters and return values of the tool, but for this simple tool we don't need any input parameters. As the output format is controlled by the API, we'll skip defining it here for simplicity but you can add it when you need to enforce stricter output typing.

3. **The tool handler implementation**: this function contains the actual logic of the tool, and returns the result. The content may return *unstructured content* such as text, audio or images, or *structured content* such as JSON objects or arrays. Our API always return JSON objects, so we'll return the response in the `structuredContent` field of the MCP response, but the `content` field must be present for backwards compatibility even if it's empty. Note that structured content can **only be an object**! Our API here returns an array of burgers, so we wrap it in an object with a `result` property.

<div class="info" data-title="Note">

> The `structuredContent` field was recently added to the spec, so it's also suggested to include a textual representation of the structured content in the `content` field when possible, to ensure compatibility with older MCP clients that don't support structured content yet.

</div>

#### Handling errors

What happens if the API request fails for some reason? In that case, the `fetchBurgerApi` function will throw an error, and we need to catch it to return a proper MCP error response. Let's build a helper function to handle that case and generate the MCP error response. Add the following function after the `fetchBurgerApi` function:

```ts
// Helper to create MCP tool responses with error handling
async function createToolResponse(handler: () => Promise<Record<string, any>>) {
  try {
    return {
      structuredContent: { result: await handler() },
      content: []
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error executing MCP tool:', errorMessage);
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}
```

This function takes a tool handler as a parameter, runs it, and format its result as a MCP structured content response. If an error occurs during the execution of the handler, it catches the error and returns an MCP error response with the error message.

Let's update our `get_burgers` tool to use this helper function. Replace the tool registration code with the following:

```ts
  // Get the list of available burgers
  server.registerTool(
    'get_burgers',
    {
      description: 'Get a list of all burgers in the menu',
    },
    async () => createToolResponse(async () => {
      return fetchBurgerApi('/api/burgers')
    }),
  );
```

We basically wrapped the original handler code inside the `createToolResponse` function, which will take care of the response formatting and error handling for us, so we can focus on the actual tool logic.

#### Adding a tool with input parameters

Now that we have our first tool working, let's add another one that requires input parameters. We'll create a tool to get the details of a specific burger by its ID. Add the following code after the `get_burgers` tool registration:

```ts
  // Get a specific burger by its ID
  server.registerTool(
    'get_burger_by_id',
    {
      description: 'Get a specific burger by its ID',
      inputSchema: z.object({
        id: z.string().describe('ID of the burger to retrieve'),
      }),
    },
    async (args) => createToolResponse(async () => {
      return fetchBurgerApi(`/api/burgers/${args.id}`);
    }),
  );
```

This tool is similar to the previous one, but it includes an `inputSchema` property in the tool config object. This schema defines the expected input parameters for the tool, as the `id` of the burger to retrieve is needed. The schema is defined using Zod fluent API, which is translated to a JSON schema on the MCP level.

When implementing the tool handler, we can access the input parameters through the `args` parameter, which is typed automatically according to the defined input schema. We then use the `id` parameter to build the API request URL.

#### Adding more tools

Now that we have the basic structure in place, you can continue adding the remaining tools for these remaining Burger API endpoints:
- `get_toppings`
- `get_topping_by_id`
- `get_topping_categories`
- `get_orders`
- `get_order_by_id`
- `place_order`
- `delete_order_by_id`

<div class="tip" data-title="Hint">

> You can refer to the burger API reference in the **Overview** section of this workshop to see the details of each endpoint. You also have access to the full OpenAPI specification in the `packages/burger-api/openapi.yaml` file.

</div>

To make the task easier, you can use AI code assistants like [GitHub Copilot](https://github.com/features/copilot): if you don't have access already, you can open https://github.com/features/copilot and click on the "Get started for free" button to enable GitHub Copilot for your account. Try referencing the OpenAPI specification while using **Agent mode** in the Copilot chat window to help you complete the implementation 😉

<!-- 
HINT:
Example prompt for Copilot, with `mcp.ts` open and in the context (auto model):

```
#file:openapi.yaml 

Add the following list of tools, based on the provided OpenAPI schema:

get_toppings
get_topping_by_id
get_topping_categories
get_orders
get_order_by_id
place_order
delete_order_by_id
```
-->

<div class="info" data-title="Skip notice">

> Alternatively, you can skip the remaining MCP tool implementation by running this command in the terminal **at the root of the project** to get the completed code directly:
> ```bash
> curl -fsSL https://github.com/Azure-Samples/mcp-agent-langchainjs/releases/download/latest/burger-mcp-tools.tar.gz | tar -xvz
> ```

<div>

### Adding the HTTP transport

Now that we have implemented all the MCP tools, it's time to add the HTTP transport to our MCP server so it can listen for incoming requests.
We'll use Express to create the HTTP server and integrate it with the MCP server.

Open the `src/server.ts` file and add this at the top of the file:

```ts
import process from 'node:process';
import { createMcpExpressApp } from '@modelcontextprotocol/server';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Request, Response } from 'express';
import { burgerApiUrl } from './config.js';
import { getMcpServer } from './mcp.js';

// Create the Express app with DNS rebinding protection
const app = createMcpExpressApp();

// TODO: implement MCP endpoint

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Burger MCP server listening on port ${PORT} (Using burger API URL: ${burgerApiUrl})`);
});

// Handle server shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  process.exit(0);
});
```

This is almost like a regular Express server, but we use the `createMcpExpressApp` helper function from the MCP SDK to create the Express app with built-in DNS rebinding protection, as MCP servers running on `localhost` are vulnerable to [DNS rebinding attacks](https://en.wikipedia.org/wiki/DNS_rebinding).

Next we'll replace the `TODO` with the MCP endpoint implementation. Add the following code to handle incoming MCP requests at the `/mcp` endpoint:

```ts
// Handle all MCP Streamable HTTP requests
app.all('/mcp', async (request: Request, response: Response) => {
  console.log(`Received ${request.method} request to /mcp`);

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Connect the transport to the MCP server
    const server = getMcpServer();
    await server.connect(transport);

    // Handle the request with the transport
    await transport.handleRequest(request, response, request.body);

    // Clean up when the response is closed
    response.on('close', async () => {
      await transport.close();
      await server.close();
    });
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!response.headersSent) {
      response.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32_603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});
```

Let's break down what's happening here:
1. We define a `/mcp` route that handle all HTTP methods (`GET`, `POST`, etc). For our implementation, only `POST` requests are supported, we'll handle the other methods rejection later.

2. We create the `StreamableHTTPServerTransport` instance, and explicity set the `sessionIdGenerator` to `undefined`, as want our server to be **stateless** and not maintain sessions between requests.

3. We get our MCP server instance with all the tools defined earlier, and connect it to the transport.

4. We call the request handler, that acts like an HTTP middleware, then clean up when the response is closed.

<div class="info" data-title="Note">

> MCP servers can also support stateful sessions, where the server maintains session data between requests. This is useful for some use-cases where the server needs to keep track of the state or user context between requests. However, this adds complexity to the server implementation and management, and make it more difficult to scale, so it's often better to keep the server stateless when possible.

</div>

We're almost done! Since our MCP server is stateless, we need to reject unsupported HTTP methods such as `GET` and `DELETE`, that are only needed for stateful sessions. Let's add that check at the beginning of the `/mcp` route handler. Update the beginning of the handler like this:

```ts
app.all('/mcp', async (request: Request, response: Response) => {
  console.log(`Received ${request.method} request to /mcp`);

  // Reject unsupported methods (GET/DELETE are only needed for stateful sessions)
  if (request.method !== 'POST') {
    response.writeHead(405).end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32_000,
          message: 'Method not allowed.',
        },
        id: null,
      }),
    );
    return;
  }

  ...
});
```

### Testing the MCP server

Our server is now complete and ready to be tested! Start the MCP server by running the following command from the `packages/burger-mcp` folder:

```bash
npm run start
```

Your MCP server should now be running at `http://localhost:3000/mcp`, using the Burger API URL defined in the `BURGER_API_URL` environment variable.

#### Using MCP Inspector

The easiest way to test the MCP server is with the [MCP Inspector tool](https://github.com/modelcontextprotocol/inspector). Run this command in the terminal to start the MCP Inspector:

```bash
npx -y @modelcontextprotocol/inspector
```

Open the URL shown in the console in your browser, then:

1. Set transport type to **Streamable HTTP**
2. Enter your local server URL: `http://localhost:3000/mcp`
3. Click **Connect**

After you're connected, go to the **Tools** tab to list available tools. You can then try the `get_burgers` tool to see the burger menu.

![MCP Inspector Screenshot](./assets/mcp-inspector.png)

Try playing a bit with the other tools to check your implementation!

#### [optional] Using GitHub Copilot

GitHub Copilot is an AI agent compatible with MCP servers, so you can also use it to test your MCP server implementation.

Configure GitHub Copilot to use your deployed MCP server by adding this to your project's `.vscode/mcp.json`:

```json
{
  "servers": {
    "burger-mcp": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Click on the **Start** button that will appear in this JSON file to activate the MCP server connection.

Now you can open a Copilot chat window, set the agent mode and check that the `burger-mcp` server is available selected in the tools section.

![GitHub Copilot chat screenshot showing the tools button](./assets/github-copilot-tools.png)

Try asking things like:
- *"What spicy burgers do you have?"*
- *"Place an order for two cheeseburgers"*
- *"Show my recent orders"*

Copilot will automatically discover and use the MCP tools! 🎉

<div class="tip" data-title="tip">

> If Copilot doesn't call the burger MCP tools, try checking if it's enabled by clicking on the tool icon in the chat input box and ensuring that "burger-mcp" is selected. You can also force tool usage by adding `#burger-mcp` in your prompt.

</div>

### [optional] Adding stdio transport support

It's possible to support both HTTP and stdio transports in the same MCP server implementation. This is useful if you want to be able to run the server both as a web service and as a local process communicating over stdio.

Running server locally with stdio transport is also a good approach if you have sensitive data that you don't want to expose over HTTP, like personal information or credentials.

We'll use a separate entry point for the stdio transport, so both transports can be started independently. Create a new file `src/local.ts` and add the following code:

```ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { burgerApiUrl } from './config.js';
import { getMcpServer } from './mcp.js';

try {
  const server = getMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Burger MCP server running on stdio (Using burger API URL: ${burgerApiUrl})`);
} catch (error) {
  console.error('Error starting MCP server:', error);
  process.exitCode = 1;
}
```

As you can see, this is quite straightforward: we create a `StdioServerTransport` instance and connect it to the MCP server.

To run the MCP server with stdio transport, use the following command from the `packages/burger-mcp` folder:

```bash
npm run start:local
```

// TODO: test with MCP inspector

You can also test the stdio transport with GitHub Copilot by configuring the MCP server in `.vscode/mcp.json` like this:

```json
{
  "servers": {
    "burger-mcp": {
      "type": "stdio",
      "command": "npm",
      "args": ["run", "start:local", "--workspace=burger-mcp"]
    }
  }
}
```
