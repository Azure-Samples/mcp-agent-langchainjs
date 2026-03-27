import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { cosmosDbEndpoint, azureOpenAiEndpoint, azureOpenAiApiKey, azureOpenAiModel } from '../src/config.js';

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

  const keywordSql = `SELECT TOP 1000 c.id FROM c ORDER BY RANK FullTextScore(c.text, ${termNames})`;
  const vectorSql = `SELECT TOP 1000 c.id FROM c ORDER BY VectorDistance(c.vector, @embedding)`;
  const hybridSql = `SELECT TOP 5 c.id, c.text FROM c ORDER BY RANK RRF(FullTextScore(c.text, ${termNames}), VectorDistance(c.vector, @embedding))`;

  console.log(`Search: "${query}"\n`);

  const [keywordResults, vectorResults, hybridResults] = await Promise.all([
    container.items.query({ query: keywordSql, parameters: termParams }, { forceQueryPlan: true }).fetchAll(),
    container.items.query({ query: vectorSql, parameters: [{ name: '@embedding', value: queryVector }] }, { forceQueryPlan: true }).fetchAll(),
    container.items.query({ query: hybridSql, parameters: [{ name: '@embedding', value: queryVector }, ...termParams] }, { forceQueryPlan: true }).fetchAll(),
  ]);

  const keywordRank = new Map(keywordResults.resources.map((item, i) => [item.id as string, i + 1]));
  const vectorRank = new Map(vectorResults.resources.map((item, i) => [item.id as string, i + 1]));

  const candidates = hybridResults.resources.map((item, i) => {
    const id = item.id as string;
    const text = item.text as string;
    const [title, ...rest] = text.split(' - ');
    return {
      id,
      title,
      description: rest.join(' - '),
      text,
      rrfRank: i + 1,
      kr: keywordRank.get(id),
      vr: vectorRank.get(id),
    };
  });

  // LLM reranking
  const llm = new ChatOpenAI({
    configuration: { baseURL: azureOpenAiEndpoint },
    modelName: azureOpenAiModel,
    apiKey: azureOpenAiApiKey ?? azureADTokenProvider,
  });

  const candidateList = candidates
    .map((c, i) => `[${i}] ${c.text}`)
    .join('\n');

  const response = await llm.invoke([
    {
      role: 'system',
      content: `You are a beer recommendation expert. Given a user query and a list of beer candidates, rerank them by relevance to the query. Return ONLY a JSON array of the indices of the top 5 most relevant beers, ordered from most to least relevant. Example: [3, 0, 7, 1, 5]`,
    },
    {
      role: 'user',
      content: `Query: "${query}"\n\nCandidates:\n${candidateList}`,
    },
  ]);

  const content = typeof response.content === 'string' ? response.content : '';
  const match = content.match(/\[[\d\s,]+\]/);
  if (!match) {
    console.error('Failed to parse LLM response:', content);
    process.exit(1);
  }

  const rerankedIndices: number[] = JSON.parse(match[0]);
  for (const [rank, idx] of rerankedIndices.slice(0, 5).entries()) {
    const c = candidates[idx];
    const krStr = c.kr ? `#${c.kr} keyword` : '#- keyword';
    const vrStr = c.vr ? `#${c.vr} vector` : '#- vector';
    console.log(`#${rank + 1} ${c.title} - ${krStr}, ${vrStr}, #${c.rrfRank} RRF`);
    console.log(`   ${c.description}\n`);
  }
}

main().catch(console.error);
