/* eslint-disable */
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { cosmosDbEndpoint } from '../src/config.js';

const query = '5.6% beer from france';
// const query = 'Booze-free for spicy food, for my pregant wife';
// const query = 'light, citrusy beer';
// const query = 'bière légère et citronnée';  // light, citrusy beer

async function main() {
  if (!cosmosDbEndpoint) {
    console.error('AZURE_COSMOSDB_NOSQL_ENDPOINT not set');
    process.exit(1);
  }

  const client = new CosmosClient({
    endpoint: cosmosDbEndpoint,
    aadCredentials: new DefaultAzureCredential(),
  });

  const container = client.database('beerDB').container('beerVectors');

  const terms = query.replaceAll(',', '').split(/\s+/).filter((t) => t.length > 3);
  const parameters = terms.map((term, i) => ({ name: `@term${i}`, value: term }));
  const termNames = parameters.map((p) => p.name).join(', ');
  const sql = `SELECT TOP 5 c.id, c.text, c.metadata FROM c ORDER BY RANK FullTextScore(c.text, ${termNames})`;

  console.log(`Search: "${query}"\n`);

  const { resources } = await container.items.query({ query: sql, parameters }, { forceQueryPlan: true }).fetchAll();

  for (const [i, item] of resources.entries()) {
    const [title, ...rest] = (item.text as string).split(' - ');
    const description = rest.join(' - ');
    console.log(`#${i + 1} ${title}`);
    console.log(`   ${description}\n`);
  }
}

main().catch(console.error);
