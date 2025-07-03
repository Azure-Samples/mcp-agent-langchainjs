#!/usr/bin/env node
/*
 * Creates local.settings.json file for the Azure Functions.
 * Uses .env file for loading environment variables.
 * Usage: update-local-settings.mjs
 */

import process from 'node:process';
import path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

console.log('Setting Blob Storage service values...');
settings = {
  ...settings,
  AZURE_STORAGE_URL: process.env.AZURE_STORAGE_URL,
  AZURE_STORAGE_CONTAINER_NAME: process.env.AZURE_STORAGE_CONTAINER_NAME,
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
