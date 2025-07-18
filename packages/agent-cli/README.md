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

# Combine options
npm run start "cancel my order" -- --userId user123 --new
```

The CLI maintains conversation history in `~/.burger-agent-cli/burger-agent-cli.json` for context across sessions.

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
