import { CosmosClient, Database, Container } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

export class UserDbService {
  private static instance: UserDbService;
  private client: CosmosClient | undefined = undefined;
  private database: Database | undefined = undefined;
  private usersContainer: Container | undefined = undefined;
  private isCosmosDbInitialized = false;

  static async getInstance(): Promise<UserDbService> {
    if (!UserDbService.instance) {
      UserDbService.instance = new UserDbService();
      await UserDbService.instance.initializeCosmosDb();
    }
    return UserDbService.instance;
  }

  protected async initializeCosmosDb(): Promise<void> {
    try {
      const endpoint = process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT;
      if (!endpoint) {
        console.warn('Cosmos DB endpoint not found in environment variables.');
        return;
      }
      const credential = new DefaultAzureCredential();
      this.client = new CosmosClient({ endpoint, aadCredentials: credential });
      const databaseId = 'userDB';
      const { database } = await this.client.databases.createIfNotExists({ id: databaseId });
      this.database = database;
      const { container } = await this.database.containers.createIfNotExists({
        id: 'users',
        partitionKey: { paths: ['/id'] }
      });
      this.usersContainer = container;
      this.isCosmosDbInitialized = true;
      console.log('Connected to Cosmos DB for users');
    } catch (error) {
      console.error('Failed to initialize Cosmos DB for users:', error);
    }
  }

  async getUserById(id: string): Promise<any | undefined> {
    if (!this.isCosmosDbInitialized) return undefined;
    try {
      const resource = await this.usersContainer!.item(id).read();
      return resource;
    } catch (error: any) {
      if (error.code === 404) return undefined;
      throw error;
    }
  }

  async createUser(id: string): Promise<any> {
    if (!this.isCosmosDbInitialized) throw new Error('Cosmos DB not initialized');
    const user = {
      id,
      createdAt: new Date().toISOString()
    };
    const { resource } = await this.usersContainer!.items.create(user);
    return resource;
  }
}
