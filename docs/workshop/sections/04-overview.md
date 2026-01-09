## Overview of the project

The project template you've forked is a monorepo, which means it's a single repository that houses multiple projects. Here's how it's organized, focusing on the key files and directories:

```sh
.devcontainer/    # Development container configuration
infra/            # Azure infrastructure as code (IaC) files
packages/         # Source code for the application's services
|- burger-api/    # Burger REST API that handles menu and orders
|- burger-mcp/    # Burger MCP server to expose the burger API as MCP tools
|- agent-api/     # Agent API, hosting the LangChain.js agent
|- agent-webapp/  # Web application to interact with the agent
package.json      # NPM workspace configuration
.env              # File that you created for environment variables
```

We're using Node.js for our servers and website, and have set up an [NPM workspace](https://docs.npmjs.com/cli/using-npm/workspaces) to manage dependencies across all projects from a single place. Running `npm install` at the root installs dependencies for all projects, simplifying monorepo management.

For instance, `npm run <script_name> --workspaces` executes a script across all projects, while `npm run <script_name> --workspace=backend` targets just the backend.

Otherwise, you can use your regular `npm` commands in any project folder and it will work as usual.

### About the services

We generated the initial code for our differents services with the respective CLI or generator of the frameworks we'll be using, and we've pre-written several service components so you can jump straight into the most interesting parts.

### Burger API

This is a REST API handling burger menu and orders for the restaurant. You can consider it as an existing business API of your company, and use it like an external service that your servers will interact with.

<div data-visible="$$burger_api$$">

We have deployed the Burger API for you, so you can use it to work on this workshop as if you were using a remote third-party service. We'll set up a live dashboard for you so can monitor your orders live as you're progressing in the workshop.

You can access the API at `$$burger_api$$/api`.

The complete API documentation is available by opening the [Swagger Editor](https://editor.swagger.io/?url=$$burger_api$$/api/openapi) or the [OpenAPI YAML file]($$burger_api$$/api/openapi). A quick overview of the available endpoints is also provided below.

</div>
<div data-hidden="$$burger_api$$">

The first thing you need is to start the Burger API. Even if it's running locally, you can treat it as a third-party service that your server will interact with.

To start the service, run the following command in a terminal at the root of the project:

```bash
npm start:burger
```

You can then access the API at `http://localhost:7071/api`.

The complete API documentation is available by opening the [Swagger Editor](https://editor.swagger.io/?url=http://localhost:7071/api/openapi) or the [OpenAPI YAML file](http://localhost:7071/api/openapi). A quick overview of the available endpoints is also provided below.


<div class="important" data-title="important">

> Leave this terminal running, as the API needs to be up and running for the rest of the workshop.

</div>

</div>

#### API Endpoints

The Burger API provides the following endpoints:

| Method | Path                     | Description                                                                                                                                  |
| ------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /api                     | Returns basic server status information including active and total orders                                                                    |
| GET    | /api/openapi             | Returns the OpenAPI specification in YAML format (add `?format=json` for JSON)                                                               |
| GET    | /api/burgers             | Returns a list of all burgers                                                                                                                |
| GET    | /api/burgers/{id}        | Retrieves a specific burger by its ID                                                                                                        |
| GET    | /api/toppings            | Returns a list of all toppings (can be filtered by category with `?category=X`)                                                              |
| GET    | /api/toppings/{id}       | Retrieves a specific topping by its ID                                                                                                       |
| GET    | /api/toppings/categories | Returns a list of all topping categories                                                                                                     |
| GET    | /api/orders              | Returns a list of all orders in the system                                                                                                   |
| POST   | /api/orders              | Places a new order with burgers (requires `userId`, optional `nickname`)                                                                     |
| GET    | /api/orders/{orderId}    | Retrieves an order by its ID                                                                                                                 |
| DELETE | /api/orders/{orderId}    | Cancels an order if it has not yet been started (status must be 'pending', requires `userId` as a query parameter (e.g., `?userId={userId}`) |
| GET    | /api/images/{filepath}   | Retrieves image files (e.g., /api/images/burgers/burger-1.jpg)                                                                               |

#### Order Limits

A user can have a maximum of **5 active orders** (status: `pending` or `in-preparation`) at a time. Additionally, a single order cannot exceed **50 burgers** in total across all items.

These limits ensure fair use and prevent abuse.

### Agent API specification

To create a chat-like experience with our agent, we need to define how the user interface and the agent API will communicate. For this, we use a JSON-based protocol described below. For your own projects, you can choose to extend or implement a different protocol if needed.

#### Chat request

A chat request is sent in JSON format, and must contain at least the user's message. Optional parameters include context-specific data that can tailor the agent service's behavior.

```json
{
  "messages": [
    {
      "content": "Do you have fish-based burgers on the menu?",
      "role": "user"
    }
  ],
  "context": { ... }
}
```

#### Chat response

As agent tasks can involve multiple steps and take some time, the agent API will stream responses so intermediate feedback can be provided to the user interface. The response will then be a stream of JSON objects, each representing a chunk of the response. This format allows for a dynamic and real-time messaging experience, as each chunk can be sent and rendered as soon as it's ready.

We use the [Newline Delimited JSON (NDJSON)](https://github.com/ndjson/ndjson-spec) format, which is a convenient way of sending structured data that may be processed one record at a time.

Each JSON chunk can be one of the following types:

1. **Tool calling**

When the agent decides to call a tool, it sends a message with the tool's name and input parameters.

```json
{
  "delta": {
    "context": {
      "currentStep": {
        "type": "tool",
        "name": "get_burgers",
        "input": null
      }
    }
  }
}
```

2. **LLM response**

When the agent is processing a step that involves the LLM, it sends a message with the current content generated.

```json
{
  "delta": {
    "context": {
      "currentStep": {
        "type": "llm",
        "name": "ChatOpenAI",
        "input": { ... },
        "output": { ... }
      }
    }
  }
}
```

3. **Streaming final answer**

When the agent has completed its task and has a final answer for the user, it streams the content of the answer a few words or characters at a time.

```json
{
  "delta": {
    "content": "Yes, we have",
    "role": "assistant"
  }
}
```
