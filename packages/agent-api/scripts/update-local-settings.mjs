#!/usr/bin/env node
/*
 * Creates local.settings.json file for the Azure Functions.
 * Uses .env file for loading environment variables.
 * Usage: update-local-settings.mjs
 */

import process from 'node:process';
import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Env file is located in the root of the repository
dotenv.config({ path: path.join(__dirname, '../../../.env') });

let settings = {
  FUNCTIONS_WORKER_RUNTIME: 'node',
  AzureWebJobsFeatureFlags: 'EnableWorkerIndexing',
  AzureWebJobsStorage: 'UseDevelopmentStorage=true',
};
const settingsFilePath = path.join(__dirname, '../local.settings.json');

console.log('Setting Azure AI service values...');
settings = {
  ...settings,
  AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_INSTANCE_NAME: process.env.AZURE_OPENAI_INSTANCE_NAME,
  AZURE_OPENAI_CHAT_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT_NAME,
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
};

console.log('Setting Cosmos DB service values...');
settings = {
  ...settings,
  AZURE_COSMOSDB_NOSQL_ENDPOINT: process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT,
};

writeFileSync(
  settingsFilePath,
  JSON.stringify(
    {
      IsEncrypted: false,
      Values: settings,
    },
    null,
    2,
  ),
);
console.log('local.settings.json file updated successfully.');
