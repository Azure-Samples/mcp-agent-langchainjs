import { Container, CosmosClient, Database } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import beersData from '../data/beers.json' with { type: 'json' };
import { type Beer } from './beer.js';
import { cosmosDbEndpoint } from './config.js';

function stripUnderscoreProperties<T extends object>(object: T): T {
  if (!object || typeof object !== 'object') return object;
  const result: Record<string, any> = {};
  for (const key of Object.keys(object)) {
    if (!key.startsWith('_')) {
      result[key] = (object as any)[key];
    }
  }

  return result as T;
}

export class DbService {
  private static instance: DbService;
  private client: CosmosClient | undefined = undefined;
  private database: Database | undefined = undefined;
  private beersContainer: Container | undefined = undefined;
  private isInitialized = false;

  static async getInstance(): Promise<DbService> {
    if (!DbService.instance) {
      const instance = new DbService();
      await instance.initialize();
      DbService.instance = instance;
    }

    return DbService.instance;
  }

  private async initialize(): Promise<void> {
    if (!cosmosDbEndpoint) {
      throw new Error('AZURE_COSMOSDB_NOSQL_ENDPOINT is required. No local fallback is available for beer-mcp.');
    }

    const credential = new DefaultAzureCredential();
    this.client = new CosmosClient({
      endpoint: cosmosDbEndpoint,
      aadCredentials: credential,
    });

    const { database } = await this.client.databases.createIfNotExists({
      id: 'beerDB',
    });
    this.database = database;

    const { container } = await this.database.containers.createIfNotExists({
      id: 'beers',
      partitionKey: { paths: ['/id'] },
    });
    this.beersContainer = container;

    this.isInitialized = true;
    await this.seedIfEmpty();
    console.log('Successfully connected to Cosmos DB for beer data');
  }

  private async seedIfEmpty(): Promise<void> {
    if (!this.isInitialized) return;

    const iterator = this.beersContainer!.items.query('SELECT VALUE COUNT(1) FROM c');
    const response = await iterator.fetchAll();
    const count = response.resources[0];

    if (count === 0) {
      console.log('Seeding beers data to Cosmos DB...');
      const beers = beersData as Beer[];
      await Promise.all(beers.map(async (beer) => this.beersContainer!.items.create(beer)));
    }
  }

  async getBeerById(id: string): Promise<Beer | undefined> {
    if (!this.isInitialized) {
      throw new Error('DbService is not initialized');
    }

    try {
      const { resource } = await this.beersContainer!.item(id, id).read();
      return resource ? stripUnderscoreProperties(resource as Beer) : undefined;
    } catch (error) {
      console.error(`Error fetching beer ${id} from Cosmos DB:`, error);
      throw error;
    }
  }
}
