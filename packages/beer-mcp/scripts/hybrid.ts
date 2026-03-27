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
  const azureADTokenProvider = getBearerTokenProvider(
    credential,
    'https://cognitiveservices.azure.com/.default',
  );

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
  const termParams = terms.map((term, i) => ({ name: `@term${i}`, value: term }));
  const termNames = termParams.map((p) => p.name).join(', ');

  const keywordSql = `SELECT TOP 1000 c.id, c.text FROM c ORDER BY RANK FullTextScore(c.text, ${termNames})`;
  const vectorSql = `SELECT TOP 1000 c.id, c.text FROM c ORDER BY VectorDistance(c.vector, @embedding)`;
  const hybridSql = `SELECT TOP 5 c.id, c.text FROM c ORDER BY RANK RRF(FullTextScore(c.text, ${termNames}), VectorDistance(c.vector, @embedding), [1,1])`;

  console.log(`Search: "${query}"\n`);

  const [keywordResults, vectorResults, hybridResults] = await Promise.all([
    container.items.query({ query: keywordSql, parameters: termParams }, { forceQueryPlan: true }).fetchAll(),
    container.items.query({ query: vectorSql, parameters: [{ name: '@embedding', value: queryVector }] }, { forceQueryPlan: true }).fetchAll(),
    container.items.query({ query: hybridSql, parameters: [{ name: '@embedding', value: queryVector }, ...termParams] }, { forceQueryPlan: true }).fetchAll(),
  ]);

  const keywordRank = new Map(keywordResults.resources.map((item, i) => [item.id as string, i + 1]));
  const vectorRank = new Map(vectorResults.resources.map((item, i) => [item.id as string, i + 1]));

  const allIds = new Set([...keywordRank.keys(), ...vectorRank.keys()]);
  const k = 60;
  const scored = [...allIds].map((id) => {
    const kr = keywordRank.get(id) ?? Infinity;
    const vr = vectorRank.get(id) ?? Infinity;
    const rrf = 1 / (k + kr) + 1 / (k + vr);
    return { id, rrf, kr, vr };
  });
  scored.sort((a, b) => b.rrf - a.rrf);

  const textMap = new Map<string, string>();
  for (const item of keywordResults.resources) {
    textMap.set(item.id as string, item.text as string);
  }
  for (const item of vectorResults.resources) {
    textMap.set(item.id as string, item.text as string);
  }

  for (const [i, { id, rrf, kr, vr }] of scored.slice(0, 5).entries()) {
    const text = textMap.get(id)!;
    const [title, ...rest] = text.split(' - ');
    const description = rest.join(' - ');
    const krStr = kr === Infinity ? '#- keyword' : `#${kr} keyword`;
    const vrStr = vr === Infinity ? '#- vector' : `#${vr} vector`;
    console.log(`#${i + 1} ${title} - ${krStr}, ${vrStr}, RRF score: ${rrf.toFixed(6)}`);
    console.log(`   ${description}\n`);
  }

  // Native hybrid search results
  console.log('--- Native Cosmos DB Hybrid (RRF) ---\n');
  for (const [i, item] of hybridResults.resources.entries()) {
    const [title, ...rest] = (item.text as string).split(' - ');
    const description = rest.join(' - ');
    console.log(`#${i + 1} ${title}`);
    console.log(`   ${description}\n`);
  }

  // Compare rankings
  const manualTop5 = scored.slice(0, 5).map((s) => s.id);
  const nativeTop5 = hybridResults.resources.map((item) => item.id as string);
  const match = manualTop5.every((id, i) => id === nativeTop5[i]);
  console.log(`--- Comparison: ${match ? 'MATCH ✅' : 'DIVERGE ❌'} ---`);
  if (!match) {
    console.log(`Manual: ${manualTop5.join(', ')}`);
    console.log(`Native: ${nativeTop5.join(', ')}`);
  }
}

main().catch(console.error);
