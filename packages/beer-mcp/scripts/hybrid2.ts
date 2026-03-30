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

  const terms = query.split(/\s+/);
  const termParameters = terms.map((term, i) => ({ name: `@term${i}`, value: term }));
  const termNames = termParameters.map((p) => p.name).join(', ');

  const keywordSql = `SELECT TOP 1000 c.id FROM c ORDER BY RANK FullTextScore(c.text, ${termNames})`;
  const vectorSql = `SELECT TOP 1000 c.id FROM c ORDER BY VectorDistance(c.vector, @embedding)`;
  const hybridSql = `SELECT TOP 10 c.id, c.text FROM c ORDER BY RANK RRF(FullTextScore(c.text, ${termNames}), VectorDistance(c.vector, @embedding))`;

  console.log(`Search: "${query}"\n`);

  const [keywordResults, vectorResults, hybridResults] = await Promise.all([
    container.items.query({ query: keywordSql, parameters: termParameters }, { forceQueryPlan: true }).fetchAll(),
    container.items
      .query({ query: vectorSql, parameters: [{ name: '@embedding', value: queryVector }] }, { forceQueryPlan: true })
      .fetchAll(),
    container.items
      .query(
        { query: hybridSql, parameters: [{ name: '@embedding', value: queryVector }, ...termParameters] },
        { forceQueryPlan: true },
      )
      .fetchAll(),
  ]);

  const keywordRank = new Map(keywordResults.resources.map((item, i) => [item.id as string, i + 1]));
  const vectorRank = new Map(vectorResults.resources.map((item, i) => [item.id as string, i + 1]));

  for (const [i, item] of hybridResults.resources.entries()) {
    console.log(item);
    const id = item.id as string;
    const [title, ...rest] = (item.text as string).split(' - ');
    const description = rest.join(' - ');
    const kr = keywordRank.get(id);
    const vr = vectorRank.get(id);
    const k = 60;
    const rrf = 1 / (k + (kr ?? Infinity)) + 1 / (k + (vr ?? Infinity));
    const krString = kr ? `#${kr} keyword` : '#- keyword';
    const vrString = vr ? `#${vr} vector` : '#- vector';
    console.log(`#${i + 1} ${title} - ${krString}, ${vrString}, RRF score: ${rrf.toFixed(6)}`);
    console.log(`   ${description}\n`);
  }
}

main().catch(console.error);
