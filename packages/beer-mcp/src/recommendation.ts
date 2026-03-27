import { Document } from '@langchain/core/documents';
import {
  AzureCosmosDBNoSQLVectorStore,
} from '@langchain/azure-cosmosdb';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { type Beer } from './beer.js';
import { DbService } from './db-service.js';
import { cosmosDbEndpoint, azureOpenAiEndpoint, azureOpenAiApiKey, azureOpenAiModel } from './config.js';

let vectorStore: AzureCosmosDBNoSQLVectorStore | undefined;
let llm: ChatOpenAI | undefined;

function getAzureADTokenProvider() {
  return getBearerTokenProvider(
    new DefaultAzureCredential(),
    'https://cognitiveservices.azure.com/.default',
  );
}

function getEmbeddings() {
  const azureADTokenProvider = getAzureADTokenProvider();
  return new OpenAIEmbeddings({
    configuration: { baseURL: azureOpenAiEndpoint },
    model: process.env.AZURE_OPENAI_EMBEDDINGS_MODEL ?? 'text-embedding-3-small',
    apiKey: azureOpenAiApiKey ?? azureADTokenProvider,
  });
}

function getLlm(): ChatOpenAI {
  if (llm) return llm;

  const azureADTokenProvider = getAzureADTokenProvider();
  llm = new ChatOpenAI({
    configuration: { baseURL: azureOpenAiEndpoint },
    modelName: azureOpenAiModel,
    apiKey: azureOpenAiApiKey ?? azureADTokenProvider,
  });
  return llm;
}

async function getVectorStore(): Promise<AzureCosmosDBNoSQLVectorStore> {
  if (vectorStore) return vectorStore;

  const store = new AzureCosmosDBNoSQLVectorStore(getEmbeddings(), {
    endpoint: cosmosDbEndpoint,
    databaseName: 'beerDB',
    containerName: 'beerVectors',
  });
  await store.initialize();

  const container = store.getContainer();
  const { resources } = await container.items.query('SELECT VALUE COUNT(1) FROM c').fetchAll();
  if (resources[0] === 0) {
    console.log('Indexing beer data into vector store...');
    const db = await DbService.getInstance();
    const beersContainer = db.getBeersContainer();
    const iterator = beersContainer.items.readAll<Beer>().getAsyncIterator();
    let batch: Document[] = [];
    let total = 0;

    for await (const { resources: beers } of iterator) {
      for (const beer of beers) {
        batch.push(
          new Document({
            pageContent: `${beer.name} - ${beer.style} by ${beer.brewery} (${beer.country}, ${beer.abv}% ABV). ${beer.description} Flavors: ${beer.flavorNotes.join(', ')}. Pairs with: ${beer.pairingNotes.join(', ')}.`,
            metadata: { beerId: beer.id },
          }),
        );
        if (batch.length >= 100) {
          await store.addDocuments(batch);
          total += batch.length;
          batch = [];
        }
      }
    }

    if (batch.length > 0) {
      await store.addDocuments(batch);
      total += batch.length;
    }

    console.log(`Indexed ${total} beers`);
  }

  vectorStore = store;
  return store;
}

export async function recommendBeers(query: string): Promise<Beer[]> {
  const store = await getVectorStore();

  // Step 1: Hybrid search via LangChain.js (RRF combining full-text + vector)
  const results = await store.similaritySearchWithScore(query, 10, {
    searchType: 'hybrid',
    fullTextRankFilter: [{ searchField: 'text', searchText: query }]
  });

  console.log(`Hybrid search for "${query}" returned ${results.length} candidates`);

  if (results.length === 0) return [];

  // Step 2: LLM-based reranking
  const candidateList = results
    .map(([doc], i) => `[${i}] ${doc.pageContent}`)
    .join('\n');

  const model = getLlm();
  const response = await model.invoke([
    {
      role: 'system',
      content: 'You are a beer recommendation expert. Given a user query and a list of beer candidates, rerank them by relevance to the query. Return ONLY a JSON array of the indices of the top 5 most relevant beers, ordered from most to least relevant. Example: [3, 0, 7, 1, 5]',
    },
    {
      role: 'user',
      content: `Query: "${query}"\n\nCandidates:\n${candidateList}`,
    },
  ]);

  const content = typeof response.content === 'string' ? response.content : '';
  const match = content.match(/\[[\d\s,]+\]/);
  let rerankedIds: string[];

  if (match) {
    const indices: number[] = JSON.parse(match[0]);
    rerankedIds = indices
      .slice(0, 5)
      .filter((i) => i >= 0 && i < results.length)
      .map((i) => results[i][0].metadata.beerId as string);
    console.log(`LLM reranked to indices: ${indices.slice(0, 5).join(', ')}`);
  } else {
    console.warn('Failed to parse LLM reranking response, using hybrid order');
    rerankedIds = results.slice(0, 5).map(([doc]) => doc.metadata.beerId as string);
  }

  const db = await DbService.getInstance();
  const beers = await db.getBeersById(rerankedIds);
  const beerMap = new Map(beers.map((b) => [b.id, b]));
  return rerankedIds.map((id) => beerMap.get(id)).filter((b): b is Beer => b !== undefined);
}
