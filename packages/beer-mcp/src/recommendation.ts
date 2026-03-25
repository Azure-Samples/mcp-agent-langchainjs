import { Document } from '@langchain/core/documents';
import {
  AzureCosmosDBNoSQLVectorStore,
  type AzureCosmosDBNoSQLSearchType,
} from '@langchain/azure-cosmosdb';
import { OpenAIEmbeddings } from '@langchain/openai';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { type Beer } from './beer.js';
import { DbService } from './db-service.js';
import { cosmosDbEndpoint, azureOpenAiEndpoint, azureOpenAiApiKey } from './config.js';

let vectorStore: AzureCosmosDBNoSQLVectorStore | undefined;

async function getVectorStore(): Promise<AzureCosmosDBNoSQLVectorStore> {
  if (vectorStore) return vectorStore;

  const azureADTokenProvider = getBearerTokenProvider(
    new DefaultAzureCredential(),
    'https://cognitiveservices.azure.com/.default',
  );

  const embeddings = new OpenAIEmbeddings({
    configuration: { baseURL: azureOpenAiEndpoint },
    model: process.env.AZURE_OPENAI_EMBEDDINGS_MODEL ?? 'text-embedding-3-small',
    apiKey: azureOpenAiApiKey ?? azureADTokenProvider,
  });

  const store = new AzureCosmosDBNoSQLVectorStore(embeddings, {
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

export type SearchMode = AzureCosmosDBNoSQLSearchType;

export async function recommendBeers(query: string, searchMode?: SearchMode): Promise<Beer[]> {
  const store = await getVectorStore();
  const results = await store.similaritySearchWithScore(query, 5, {
    searchType: searchMode,
  });

  console.log(`Search query: "${query}" [mode: ${searchMode ?? 'vector'}]`);
  console.log('Search results:', JSON.stringify(results, null, 2));

  const db = await DbService.getInstance();
  const ids = results.map((doc) => doc[0].metadata.beerId as string);
  const beers = await db.getBeersById(ids);
  const beerMap = new Map(beers.map((b) => [b.id, b]));
  return ids.map((id) => beerMap.get(id)).filter((b): b is Beer => b !== undefined);
}
