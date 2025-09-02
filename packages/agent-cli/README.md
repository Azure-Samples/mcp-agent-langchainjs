# Contoso Burgers AI lightweight Agent CLI

## Available Scripts

In the project directory, you can run:

### `npm start`

Run the burger agent CLI. Usage examples:

```bash
# Ask a simple question
npm run start "show me the burger menu"

# Ask with a specific user ID
npm run start "place an order" -- --userId user123

# Start a new session
npm run start "hello" -- --new

# Use local MCP server
npm run start "show me the menu" -- --local

# Combine options
npm run start "cancel my order" -- --userId user123 --new --local
```

The CLI maintains conversation history in `~/.burger-agent-cli/burger-agent-cli.json` for context across sessions.

### Options

- `--userId <userId>`: Specify a user ID for operations that require user context (like placing or cancelling orders)
- `--new`: Start a new conversation session, discarding previous history
- `--verbose`: Show intermediate steps and tool calls during execution
- `--local`: Force connection to localhost MCP server (http://localhost:3000/mcp) instead of using BURGER_MCP_URL environment variable

### `npm run build`

To build the CLI for production to the `dist` folder.

After building, you can install the CLI  globally with:

```bash
npm install -g .
```

And then run it with:

```bash
agent-cli --help
```
