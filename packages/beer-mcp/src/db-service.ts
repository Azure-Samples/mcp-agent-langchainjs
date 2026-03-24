import { BulkOperationType, Container, CosmosClient, Database } from '@azure/cosmos';
import { CosmosDBManagementClient } from "@azure/arm-cosmosdb";
import { DefaultAzureCredential } from '@azure/identity';
import beersData from '../data/beers.json' with { type: 'json' };
import { type Beer } from './beer.js';
import { cosmosDbEndpoint, subscriptionId } from './config.js';

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

export interface BeerStats {
  totalBeers: number;
  totalBreweries: number;
  totalCountries: number;
  totalStyles: number;
  nonAlcoholicBeers: number;
  averageAbv: number;
  strongestAbv: number;
  lightestAbv: number;
}

export class DbService {
  private static instance: DbService;
  private client: CosmosClient | undefined = undefined;
  private database: Database | undefined = undefined;
  private beersContainer: Container | undefined = undefined;
  private isInitialized = false;
  private cachedStats: BeerStats | undefined = undefined;

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
      console.error('Cosmos DB endpoint not found in environment variables. Beer MCP requires AZURE_COSMOSDB_NOSQL_ENDPOINT.');
      return;
    }

    try {
      const credential = new DefaultAzureCredential();
      this.client = new CosmosClient({
        endpoint: cosmosDbEndpoint,
        aadCredentials: credential,
      });

      try {
        this.database = this.client.database('beerDB');
        this.beersContainer = this.database.container('beers');
        await this.beersContainer.read();
      } catch {
        console.log('Database or container not found, creating via control plane...');
        await this.initializeControlPlane();
        this.database = this.client.database('beerDB');
        this.beersContainer = this.database.container('beers');
      }

      this.isInitialized = true;
      await this.seedIfEmpty();
      console.log('Successfully connected to Cosmos DB for beer data');
    } catch (error: any) {
      console.error('Failed to initialize Cosmos DB:', error.message);
    }
  }

  private async initializeControlPlane(): Promise<void> {
    try {
      if (!subscriptionId) {
        console.error('Azure subscription ID not found in environment variables. Control plane operations require AZURE_SUBSCRIPTION_ID.');
        return;
      }

      if (!cosmosDbEndpoint) {
        console.error('Cosmos DB endpoint not found in environment variables.');
        return;
      }

      const credential = new DefaultAzureCredential();
      const client = new CosmosDBManagementClient(credential, subscriptionId);

      let resourceGroupName: string | undefined;
      let accountName: string | undefined;
      for await (const account of client.databaseAccounts.list()) {
        if (account.documentEndpoint === cosmosDbEndpoint) {
          accountName = account.name;
          const match = account.id?.match(/\/resourceGroups\/([^/]+)\//i);
          resourceGroupName = match?.[1];
          break;
        }
      }

      if (!resourceGroupName || !accountName) {
        console.error('Could not find Cosmos DB account matching endpoint:', cosmosDbEndpoint);
        return;
      }

      const databaseName = 'beerDB';
      const containerName = 'beers';

      await client.sqlResources.beginCreateUpdateSqlDatabaseAndWait(
        resourceGroupName,
        accountName,
        databaseName,
        { resource: { id: databaseName } },
      );

      await client.sqlResources.beginCreateUpdateSqlContainerAndWait(
        resourceGroupName,
        accountName,
        databaseName,
        containerName,
        {
          resource: {
            id: containerName,
            partitionKey: { paths: ['/id'] },
          },
        },
      );

      console.log('Successfully created database and container via control plane');
    } catch (error: any) {
      console.error('Failed to initialize Cosmos DB control plane client:', error.message);
    }
  }

  private async seedIfEmpty(): Promise<void> {
    if (!this.isInitialized) return;

    const iterator = this.beersContainer!.items.query('SELECT VALUE COUNT(1) FROM c');
    const response = await iterator.fetchAll();
    const count = response.resources[0];

    if (count === 0) {
      console.log('Seeding beers data to Cosmos DB...');
      const beers = beersData as Beer[];
      const operations = beers.map((beer) => ({
        operationType: BulkOperationType.Create,
        partitionKey: beer.id,
        resourceBody: beer as unknown as Record<string, any>,
      }));
      const bulkResponse = await this.beersContainer!.items.executeBulkOperations(operations);
      const failures = bulkResponse.filter((r) => r.error);
      if (failures.length > 0) {
        console.error(`Failed to seed ${failures.length} beers`);
        console.error(failures.map((f) => JSON.stringify(f.error)).join('\n'));
      }

      console.log(`Seeded ${beers.length - failures.length} beers`);
    }
  }

  async getStats(): Promise<BeerStats> {
    if (!this.isInitialized) {
      throw new Error('DbService is not initialized');
    }

    if (this.cachedStats) return this.cachedStats;

    const { resources } = await this.beersContainer!.items.query(
      `SELECT
        COUNT(1) AS totalBeers,
        COUNT(DISTINCT c.brewery) AS totalBreweries,
        COUNT(DISTINCT c.country) AS totalCountries,
        COUNT(DISTINCT c.style) AS totalStyles,
        AVG(c.abv) AS averageAbv,
        MAX(c.abv) AS strongestAbv,
        MIN(c.abv) AS lightestAbv
      FROM c`,
    ).fetchAll();

    const { resources: naResources } = await this.beersContainer!.items.query(
      'SELECT VALUE COUNT(1) FROM c WHERE c.abv < 1',
    ).fetchAll();

    const row = resources[0];
    this.cachedStats = {
      totalBeers: row.totalBeers,
      totalBreweries: row.totalBreweries,
      totalCountries: row.totalCountries,
      totalStyles: row.totalStyles,
      nonAlcoholicBeers: naResources[0],
      averageAbv: Math.round(row.averageAbv * 10) / 10,
      strongestAbv: row.strongestAbv,
      lightestAbv: row.lightestAbv,
    };

    return this.cachedStats;
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
