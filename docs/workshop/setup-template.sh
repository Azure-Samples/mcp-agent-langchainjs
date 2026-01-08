#!/usr/bin/env bash
##############################################################################
# Usage: ./setup-template.sh
# Setup the workshop template.
##############################################################################
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

##############################################################################
# Template setup
##############################################################################

echo "Preparing project template for workshop..."

# Remove unnecessary files
# rm -rf node_modules
rm -rf .github/workflows
rm -rf .github/agents
rm -rf .github/instructions/cli*.md
rm -rf .github/instructions/genaiscript*.md
rm -rf .github/instructions/script*.md
rm -rf .github/*.md
rm -rf .github/prompts
rm -rf .github/scripts
rm -rf packages/agent-cli
rm -rf packages/burger-data
rm -rf packages/burger-webapp
rm -rf packages/burger-mcp/.env.example
rm -rf package-lock.json
rm -rf docs/blog
rm -rf docs/eli5.md
rm -rf .azure
# rm -rf .env
# rm -rf ./*.env
rm -rf *.ipynb.md
rm -rf TODO*
rm -rf .genaiscript

###############################################################################
# burger-mcp
###############################################################################

echo -e "" > packages/burger-mcp/src/server.ts
echo -e "" > packages/burger-mcp/src/mcp.ts
echo -e "import path from 'node:path';
import dotenv from 'dotenv';

// ------------------------------------------------
// Init config from environment variables
// ------------------------------------------------

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Env file is located in the root of the repository
dotenv.config({ path: path.join(__dirname, '../../../.env'), quiet: true });

// Use --local option to force MCP server to connect to local Burger API
const localApiUrl = 'http://localhost:7071';
const burgerApiUrl = process.argv[2] === '--local' ? localApiUrl : process.env.BURGER_API_URL || localApiUrl;
" > packages/burger-mcp/src/config.ts

###############################################################################
# agent-api
###############################################################################

# TODO

##############################################################################
# agent-webapp
##############################################################################

# TODO

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


# Install dependencies
echo "Running npm install..."
npm install

rm -rf docs/workshop/setup-template.sh

# Commit changes
git add .
git commit -m "chore: complete project setup"

echo "Template ready!"
