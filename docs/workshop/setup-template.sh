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
rm -rf packages/burger-mcp/src/local.ts
rm -rf package-lock.json
rm -rf docs/blog
rm -rf docs/eli5.md
rm -rf .azure
# rm -rf .env
# rm -rf ./*.env
rm -rf env.js
rm -rf *.ipynb.md
rm -rf TODO*
rm -rf .genaiscript
rm -rf .vscode/mcp.json

###############################################################################
# azure
###############################################################################

echo -e "# yaml-language-server: $schema=https://raw.githubusercontent.com/Azure/azure-dev/main/schemas/v1.0/azure.yaml.json

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

###############################################################################
# burger-mcp
###############################################################################

echo -e "" > packages/burger-mcp/src/server.ts
echo -e "" > packages/burger-mcp/src/mcp.ts

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
