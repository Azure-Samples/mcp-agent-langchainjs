# Azure Functions API

This project uses [Azure Functions](https://learn.microsoft.com/azure/azure-functions/functions-overview?pivots=programming-language-javascript) as a serverless API, and [LangChain.js](https://js.langchain.com/) to implement the AI capabilities.

## Available Scripts

In the project directory, you can run:

### `npm start`

This command will start the API in dev mode, and you will be able to access it through the URL `http://localhost:7071/api/`.

You can use the `api.http` file to test the API using the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension for Visual Studio Code.

### `npm run build`

To build the API for production to the `dist` folder.

### `npm run cli`

Run the burger agent CLI. Usage examples:

```bash
# Ask a simple question
npm run cli "show me the burger menu"

# Ask with a specific user ID
npm run cli "place an order" -- --userId user123

# Start a new session
npm run cli "hello" -- --new

# Combine options
npm run cli "cancel my order" -- --userId user123 --new
```

The CLI maintains conversation history in `~/.burger-agent-cli/burger-agent-cli.json` for context across sessions.
