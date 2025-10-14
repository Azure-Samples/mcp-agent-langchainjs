#!/usr/bin/env node
/*
 * Creates local.settings.json file for the Azure Functions.
 * Uses .env file for loading environment variables.
 * Usage: update-local-settings.mjs
 */

import path from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const settings = {
  FUNCTIONS_WORKER_RUNTIME: 'custom',
};
const settingsFilePath = path.join(__dirname, '../local.settings.json');

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
