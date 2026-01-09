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
  find "$src" -type d -not -path '*node_modules*' -not -path '*/.git' -not -path '*.git/*' -not -path '*/dist' -not -path '*dist/*' -not -path '*/lib' -not -path '*lib/*' -exec mkdir -p '{}' "$dest/{}" ';'
  find "$src" -type f -not -path '*node_modules*' -not -path '*.git/*' -not -path '*dist/*' -not -path '*lib/*' -not -path '*/.DS_Store' -exec cp -r '{}' "$dest/{}" ';'
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
rm -rf "$target_folder/solution/TODO*"
rm -rf "$target_folder/solution/packages/agent-cli"
rm -rf "$target_folder/solution/packages/burger-data"
rm -rf "$target_folder/solution/packages/burger-webapp"
rm -rf "$target_folder/solution/packages/burger-mcp/.env.example"

# TODO: azure.yaml, agent-api, agent-webapp from solution branch? or solution script?

makeArchive . solution solution

##############################################################################
# MCP server tools
##############################################################################

echo "Creating mcp-server-tools package..."
mkdir -p "$target_folder/packages/burger-mcp/src"
cp -R packages/burger-mcp/src/mcp.ts "$target_folder/packages/burger-mcp/src/mcp.ts"
makeArchive packages burger-mcp burger-mcp-tools

##############################################################################
# Agent webapp
##############################################################################

echo "Creating agent-webapp package..."
copyFolder packages/agent-webapp
makeArchive packages agent-webapp

##############################################################################
# Deployment (CI/CD)
##############################################################################

# echo "Creating CI/CD package..."
# mkdir -p "$target_folder/ci-cd/.github/workflows"
# cp .github/workflows/deploy.yml "$target_folder/ci-cd/.github/workflows/deploy.yml"
# makeArchive . ci-cd ci-cd
