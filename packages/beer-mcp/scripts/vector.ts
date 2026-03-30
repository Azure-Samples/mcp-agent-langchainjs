/* eslint-disable */
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { OpenAIEmbeddings } from '@langchain/openai';
import { cosmosDbEndpoint, azureOpenAiEndpoint, azureOpenAiApiKey } from '../src/config.js';

const query = '5.6% beer from france';
// const query = 'Booze-free spicy food pregant wife';
// const query = 'light, citrusy beer';
// const query = 'bière légère et citronnée';  // light, citrusy beer

async function main() {
  if (!cosmosDbEndpoint) {
    console.error('AZURE_COSMOSDB_NOSQL_ENDPOINT not set');
    process.exit(1);
  }

  const credential = new DefaultAzureCredential();
  const azureADTokenProvider = getBearerTokenProvider(credential, 'https://cognitiveservices.azure.com/.default');

  const embeddings = new OpenAIEmbeddings({
    configuration: { baseURL: azureOpenAiEndpoint },
    model: process.env.AZURE_OPENAI_EMBEDDINGS_MODEL ?? 'text-embedding-3-small',
    apiKey: azureOpenAiApiKey ?? azureADTokenProvider,
  });

  const queryVector = await embeddings.embedQuery(query);

  const client = new CosmosClient({
    endpoint: cosmosDbEndpoint,
    aadCredentials: credential,
  });

  const container = client.database('beerDB').container('beerVectors');

  const sql = `SELECT TOP 5 c.id, c.text, c.metadata, VectorDistance(c.vector, @embedding) AS score FROM c ORDER BY VectorDistance(c.vector, @embedding)`;
  const parameters = [{ name: '@embedding', value: queryVector }];

  console.log(`Search: "${query}"\n`);

  const { resources } = await container.items.query({ query: sql, parameters }, { forceQueryPlan: true }).fetchAll();

  for (const [i, item] of resources.entries()) {
    const [title, ...rest] = (item.text as string).split(' - ');
    const description = rest.join(' - ');
    console.log(`#${i + 1} ${title} - Score: ${item.score.toFixed(4)}`);
    console.log(`   ${description}\n`);
  }
}

main().catch(console.error);
