import path from 'node:path';
import dotenv from 'dotenv';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

dotenv.config({ path: path.join(__dirname, '../../../.env'), quiet: true });

export const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
export const cosmosDbEndpoint = process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT;
export const azureOpenAiEndpoint = process.env.AZURE_OPENAI_API_ENDPOINT;
export const azureOpenAiApiKey = process.env.AZURE_OPENAI_API_KEY;
export const azureOpenAiModel = process.env.AZURE_OPENAI_MODEL ?? 'gpt-5-mini';
