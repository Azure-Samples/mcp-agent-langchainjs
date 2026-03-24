import { Document } from '@langchain/core/documents';
import {
  AzureCosmosDBNoSQLVectorStore,
  type AzureCosmosDBNoSQLSearchType,
} from '@langchain/azure-cosmosdb';
import { AzureOpenAIEmbeddings } from '@langchain/openai';
import { type Beer } from './beer.js';
import { DbService } from './db-service.js';
import { cosmosDbEndpoint, azureOpenAiEndpoint, azureOpenAiApiKey } from './config.js';

let vectorStore: AzureCosmosDBNoSQLVectorStore | undefined;

async function getVectorStore(): Promise<AzureCosmosDBNoSQLVectorStore> {
  if (vectorStore) return vectorStore;

  const embeddings = new AzureOpenAIEmbeddings({
    azureOpenAIApiEmbeddingsDeploymentName: process.env.AZURE_OPENAI_EMBEDDINGS_MODEL ?? 'text-embedding-3-small',
    azureOpenAIEndpoint: azureOpenAiEndpoint,
    azureOpenAIApiKey: azureOpenAiApiKey,
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
    const { resources: beers } = await beersContainer.items.readAll<Beer>().fetchAll();
    const docs = beers.map(
      (beer) =>
        new Document({
          pageContent: `${beer.name} - ${beer.style} by ${beer.brewery} (${beer.country}, ${beer.abv}% ABV). ${beer.description} Flavors: ${beer.flavorNotes.join(', ')}. Pairs with: ${beer.pairingNotes.join(', ')}.`,
          metadata: { id: beer.id },
        }),
    );
    await store.addDocuments(docs);
    console.log(`Indexed ${docs.length} beers`);
  }

  vectorStore = store;
  return store;
}

export type SearchMode = AzureCosmosDBNoSQLSearchType;

export async function recommendBeers(query: string, searchMode?: SearchMode): Promise<Beer[]> {
  const store = await getVectorStore();
  const results = await store.similaritySearch(query, 5, {
    searchType: searchMode,
  });

  const db = await DbService.getInstance();
  const beers = await Promise.all(
    results.map((doc) => db.getBeerById(doc.metadata.id as string)),
  );
  return beers.filter((b): b is Beer => b !== undefined);
}
