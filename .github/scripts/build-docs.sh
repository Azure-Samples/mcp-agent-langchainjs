#!/usr/bin/env bash
##############################################################################
# Usage: ./build-docs.sh [--local]
# Build the docs and push them to the "docs" branch on GitHub.
##############################################################################

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

DOCS_HOME=/tmp/mcp-agent-langchainjs-docs
GH_USER=$(git config user.name)
REPO=$(git remote get-url origin)
BASE=$(pwd)

echo "Target repository: $REPO"
echo "Preparing all workshop docs..."
echo "(temp folder: $DOCS_HOME)"
rm -rf "$DOCS_HOME"
mkdir -p "$DOCS_HOME"

cp -R docs/workshop "$DOCS_HOME"/docs
cd "$DOCS_HOME"

# Build docs
cd docs
moaw build _workshop.md -d workshop.md

if [[ ${1-} == "--local" ]]; then
  echo "Local mode: skipping GitHub push."
  open "$DOCS_HOME"
else
  # Update git repo
  cd "$BASE"
  git fetch --depth=1
  git checkout docs --
  git rm -r '*'
  cp -R "$DOCS_HOME"/docs/* .
  git add .
  git commit --amend -m "docs: prepare workshop docs"
  git push -u origin docs --force
  rm -rf "$DOCS_HOME"
fi

echo "Successfully updated workshop docs."
