<div align="center">

# Burger data generator

[![Open project in GitHub Codespaces](https://img.shields.io/badge/Codespaces-Open-blue?style=flat-square&logo=github)](https://codespaces.new/Azure-Samples/mcp-agent-langchainjs?hide_repo_select=true&ref=main&quickstart=true)
![Node version](https://img.shields.io/badge/Node.js->=22-3c873a?style=flat-square)
[![GenAIScript](https://img.shields.io/badge/GenAIScript-f7df1e?style=flat-square&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MzAgNjMwIj48cGF0aCBmaWxsPSIjMzMzIiBkPSJNMCAwdjYzMGg2MzBWMEgwem0yNDggMjdjMTAgMSAyMyAxMyAyNiA1IDMtMiAxMCAwIDE1LTEgOC0yIDQgNyA1IDExdjk5YzEgMjItNyA0OC0zMCA1Ni0yMiA3LTQ2IDUtNjgtMXYtMjFjMjAgNiA0NCAxMyA2NSAyIDEzLTggMTItMjUgMTItMzktMjAgMTctNTQgMjEtNzQgMy0xOC0xOS0xOS00Ny0xNC03MSA2LTI1IDMyLTQ1IDU5LTQybDQtMXptMTQwIDAgMTAgMWMyNCAxIDQyIDIxIDQ0IDQzbDEgMjRoLTk0Yy0xIDIwIDEzIDQxIDM0IDQzIDIwIDQgNDEtMyA1Ny0xNHYyM2MtMjkgMTMtNjYgMTctOTMtNC0yMi0yMC0yNC01My0xNC04MCA4LTIyIDMyLTM1IDU1LTM2em0xNTEgMWMxMy0xIDI1IDMgMzMgMTMgMTQgMTggOSA0MiAxMCA2M3Y1MWgtMjJWNzBjMS0xNy0xOC0yNi0zMy0yMi0xMCA0LTMwIDctMzAgMjB2ODdoLTIyVjMxaDIyYzAgNy0zIDIwIDcgOCAxMC03IDIzLTExIDM1LTExek0zODcgNDVjLTE3IDAtMzMgMTAtMzcgMjctNSAxMCA2IDcgMTIgN2g2MGMxLTE2LTEwLTMzLTI4LTM0aC03em0tMTQ2IDFjLTExIDEtMjEgNC0yOCAxMy0xMSAxNy0xMSAzOS00IDU4czMyIDE5IDQ5IDEybDE1LThWNTNjLTktNC0yMS03LTMyLTd6bTEzOCAxMzcgNzAgMTN2MzgwaC03NHYtNjVoLTgzbC0zOSA3Ny02OC0yNyAxOTQtMzc4em0xMzQgMTZoNjl2Mzc3aC02OVYxOTl6TTM3NSAzNDhsLTUwIDk4aDUwdi05OHoiLz48L3N2Zz4=)](https://aka.ms/genaiscript)

[Overview](#overview) • [Installation](#installation) • [Usage](#scripts) • [How it works](#how-it-works)

</div>

This package contains [GenAIScript](https://aka.ms/genaiscript)-powered tools for generating burger restaurant data, including the menu and images. The generated data is then used by the burger API service.

## Overview

The data generated includes:
- Burger menu data (names, descriptions, prices, toppings)
- High-quality food images for burgers and toppings

## Installation

1. Run `npm install` to install the necessary dependencies.
2. Make sure you have access to a large language model (LLM) like `gpt-4o`, `gpt-4.1` or `gpt-5` on either OpenAI or Azure OpenAI for the text data generation, to a model like `gpt-image-1` or `dall-e-3` for image generation.
  * See this [guide](https://learn.microsoft.com/azure/ai-foundry/openai/how-to/create-resource?pivots=web-portal) for deploying a text generation model on Azure OpenAI.
  * See this [guide](https://learn.microsoft.com/azure/ai-foundry/openai/how-to/dall-e?tabs=gpt-image-1) for deploying an image generation model on Azure OpenAI.
3. Set these environment variables or add them to a `.env` file:

```bash
GENAISCRIPT_DEFAULT_MODEL="azure:gpt-5"   # or "openai:gpt-5"
GENAISCRIPT_IMAGE_MODEL="azure:gpt-image-1" # or "openai:gpt-image-1"

# For Azure OpenAI, set the following variables:
AZURE_OPENAI_API_KEY="your-azure-openai-api-key"
AZURE_OPENAI_API_ENDPOINT="https://your-azure-openai-endpoint.openai.azure.com"

# For OpenAI, set the following variable:
OPENAI_API_KEY="your-openai-api-key"
```

## Usage

### Generate burger menu data

```bash
npm run generate:burgers
```
Generates a complete burger menu with original burgers and toppings.

### Generate food images

```bash
npm run generate:images
```
Generates realistic food images for the menu items using AI image generation.

> [!NOTE]
> You first need to generate the burger menu data before generating images, as the image generation script uses the generated menu data.

## How it works

Open the scripts in `scripts/` to see how GenAIScript is used along with TypeScript to generate the data. The scripts use prompts to guide the LLM in creating realistic and appealing burger names, descriptions, prices, and images.

### Techniques used

- **Structured outputs**: We use [zod](https://zod.dev) schemas to defined the expected JSON output structure, which helps ensure the generated data is valid and consistent.
- **LLM-generated prompts**: We use the LLM to dynamically create prompts for generating appealing images.
- **Sanity checks**: We perform basic sanity checks on the generated data to detect any invalid content.
