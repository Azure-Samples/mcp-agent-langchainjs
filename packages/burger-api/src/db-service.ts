import path from 'node:path';
import { ToppingCategory } from './topping';
import { Burger } from './burger';
import { Topping } from './topping';
import { Order, OrderStatus } from './order';
import { Container, CosmosClient, Database } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import burgersData from '../data/burgers.json';
import toppingsData from '../data/toppings.json';
import dotenv from 'dotenv';

// Env file is located in the root of the repository
dotenv.config({ path: path.join(process.cwd(), '../../.env') });

// Helper to strip properties starting with underscore from an object
function stripUnderscoreProps<T extends object>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const result: { [key: string]: any } = {};
  for (const key of Object.keys(obj)) {
    if (!key.startsWith('_')) {
      result[key] = (obj as any)[key];
    }
  }
  return result as T;
}

// Helper to remove userId from Order(s)
function stripUserId<T extends Order | Order[] | undefined>(orderOrOrders: T): T {
  if (Array.isArray(orderOrOrders)) {
    return orderOrOrders.map((order) => {
      if (!order) return order;
      const { userId, ...rest } = order;
      return rest as Order;
    }) as T;
  }
  if (orderOrOrders && typeof orderOrOrders === 'object') {
    const { userId, ...rest } = orderOrOrders as Order;
    return rest as T;
  }
  return orderOrOrders;
}

// Database service for our burger API using Azure Cosmos DB
export class DbService {
  private static instance: DbService;
  private client: CosmosClient | undefined = undefined;
  private database: Database | undefined = undefined;
  private burgersContainer: Container | undefined = undefined;
  private toppingsContainer: Container | undefined = undefined;
  private ordersContainer: Container | undefined = undefined;
  private usersContainer: Container | undefined = undefined;

  // Fallback to local data if Cosmos DB is not available
  private localBurgers: Burger[] = [];
  private localToppings: Topping[] = [];
  private localOrders: Order[] = [];
  private isCosmosDbInitialized = false;

  static async getInstance(): Promise<DbService> {
    if (!DbService.instance) {
      DbService.instance = new DbService();
      await DbService.instance.initializeCosmosDb();
      DbService.instance.initializeLocalData();
    }
    return DbService.instance;
  }

  // Initialize Cosmos DB client and containers
  protected async initializeCosmosDb(): Promise<void> {
    try {
      const endpoint = process.env.AZURE_COSMOSDB_NOSQL_ENDPOINT;

      if (!endpoint) {
        console.warn('Cosmos DB endpoint not found in environment variables. Using local data.');
        return;
      }

      // Use DefaultAzureCredential for managed identity
      const credential = new DefaultAzureCredential();

      this.client = new CosmosClient({
        endpoint,
        aadCredentials: credential,
      });

      // Get or create database
      const databaseId = 'burgerDB';
      const { database } = await this.client.databases.createIfNotExists({
        id: databaseId,
      });
      this.database = database;

      // Get or create containers
      const { container: burgersContainer } = await this.database.containers.createIfNotExists({
        id: 'burgers',
        partitionKey: { paths: ['/id'] },
      });
      this.burgersContainer = burgersContainer;

      const { container: toppingsContainer } = await this.database.containers.createIfNotExists({
        id: 'toppings',
        partitionKey: { paths: ['/id'] },
      });
      this.toppingsContainer = toppingsContainer;

      const { container: ordersContainer } = await this.database.containers.createIfNotExists({
        id: 'orders',
        partitionKey: { paths: ['/id'] },
      });
      this.ordersContainer = ordersContainer;

      // Initialize connection to userDB as well to support user-related functions
      try {
        const userDbId = 'userDB';
        const { database: userDatabase } = await this.client.databases.createIfNotExists({
          id: userDbId,
        });

        // Get or create users container
        const { container: usersContainer } = await userDatabase.containers.createIfNotExists({
          id: 'users',
          partitionKey: { paths: ['/id'] },
        });

        this.usersContainer = usersContainer;
      } catch (error) {
        console.error('Failed to initialize users database:', error);
      }

      this.isCosmosDbInitialized = true;

      // Seed initial data if containers are empty
      await this.seedInitialDataIfEmpty();

      console.log('Successfully connected to Cosmos DB');
    } catch (error) {
      console.error('Failed to initialize Cosmos DB:', error);
      console.warn('Falling back to local data storage');
    }
  }

  // Seed initial data if containers are empty
  private async seedInitialDataIfEmpty(): Promise<void> {
    if (!this.isCosmosDbInitialized) return;

    try {
      // Check if Burgers container is empty
      const burgerIterator = this.burgersContainer!.items.query('SELECT VALUE COUNT(1) FROM c');
      const burgerCount = (await burgerIterator.fetchAll()).resources[0];

      if (burgerCount === 0) {
        console.log('Seeding burgers data to Cosmos DB...');
        const burgers = burgersData as Burger[];
        for (const burger of burgers) {
          await this.burgersContainer!.items.create(burger);
        }
      }

      // Check if Toppings container is empty
      const toppingIterator = this.toppingsContainer!.items.query('SELECT VALUE COUNT(1) FROM c');
      const toppingCount = (await toppingIterator.fetchAll()).resources[0];

      if (toppingCount === 0) {
        console.log('Seeding toppings data to Cosmos DB...');
        const toppings = toppingsData as Topping[];
        for (const topping of toppings) {
          await this.toppingsContainer!.items.create(topping);
        }
      }
    } catch (error) {
      console.error('Error seeding initial data:', error);
    }
  }

  // Burger methods
  async getBurgers(): Promise<Burger[]> {
    if (this.isCosmosDbInitialized) {
      try {
        const querySpec = {
          query: 'SELECT * FROM c',
        };
        const { resources } = await this.burgersContainer!.items.query(querySpec).fetchAll();
        return (resources as Burger[]).map(stripUnderscoreProps);
      } catch (error) {
        console.error('Error fetching burgers from Cosmos DB:', error);
        return [...this.localBurgers];
      }
    }
    return [...this.localBurgers];
  }

  async getBurger(id: string): Promise<Burger | undefined> {
    if (this.isCosmosDbInitialized) {
      try {
        const { resource } = await this.burgersContainer!.item(id, id).read();
        return resource ? stripUnderscoreProps(resource as Burger) : undefined;
      } catch (error) {
        console.error(`Error fetching burger ${id} from Cosmos DB:`, error);
        return this.localBurgers.find((burger) => burger.id === id);
      }
    }
    return this.localBurgers.find((burger) => burger.id === id);
  }

  // Topping methods
  async getToppings(): Promise<Topping[]> {
    if (this.isCosmosDbInitialized) {
      try {
        const querySpec = {
          query: 'SELECT * FROM c',
        };
        const { resources } = await this.toppingsContainer!.items.query(querySpec).fetchAll();
        return (resources as Topping[]).map(stripUnderscoreProps);
      } catch (error) {
        console.error('Error fetching toppings from Cosmos DB:', error);
        return [...this.localToppings];
      }
    }
    return [...this.localToppings];
  }

  async getTopping(id: string): Promise<Topping | undefined> {
    if (this.isCosmosDbInitialized) {
      try {
        const { resource } = await this.toppingsContainer!.item(id, id).read();
        return resource ? stripUnderscoreProps(resource as Topping) : undefined;
      } catch (error) {
        console.error(`Error fetching topping ${id} from Cosmos DB:`, error);
        return this.localToppings.find((topping) => topping.id === id);
      }
    }
    return this.localToppings.find((topping) => topping.id === id);
  }

  async getToppingsByCategory(category: ToppingCategory): Promise<Topping[]> {
    const toppings = await this.getToppings();
    return toppings.filter((topping) => topping.category === category);
  }

  // Order methods
  async getOrders(userId?: string): Promise<Order[]> {
    if (this.isCosmosDbInitialized) {
      try {
        let querySpec;
        if (userId) {
          querySpec = {
            query: 'SELECT * FROM c WHERE c.userId = @userId',
            parameters: [
              {
                name: '@userId',
                value: userId,
              },
            ],
          };
        } else {
          querySpec = {
            query: 'SELECT * FROM c',
          };
        }
        const { resources } = await this.ordersContainer!.items.query(querySpec).fetchAll();
        return stripUserId((resources as Order[]).map(stripUnderscoreProps));
      } catch (error) {
        console.error('Error fetching orders from Cosmos DB:', error);
        const orders = userId ? this.localOrders.filter((order) => order.userId === userId) : this.localOrders;
        return stripUserId(orders);
      }
    }
    const orders = userId ? this.localOrders.filter((order) => order.userId === userId) : this.localOrders;
    return stripUserId(orders);
  }

  async getOrder(id: string, userId?: string): Promise<Order | undefined> {
    if (this.isCosmosDbInitialized) {
      try {
        const { resource } = await this.ordersContainer!.item(id, id).read();
        if (!resource) return undefined;

        const order = stripUnderscoreProps(resource as Order);
        if (userId && order.userId !== userId) {
          return undefined;
        }
        return stripUserId(order);
      } catch (error) {
        console.error(`Error fetching order ${id} from Cosmos DB:`, error);
        const order = this.localOrders.find((order) => order.id === id);
        if (!order) return undefined;
        if (userId && order.userId !== userId) {
          return undefined;
        }
        return stripUserId(order);
      }
    }
    const order = this.localOrders.find((order) => order.id === id);
    if (!order) return undefined;
    if (userId && order.userId !== userId) {
      return undefined;
    }
    return stripUserId(order);
  }

  async createOrder(order: Order): Promise<Order> {
    if (this.isCosmosDbInitialized) {
      try {
        const { resource } = await this.ordersContainer!.items.create(order);
        return stripUserId(stripUnderscoreProps(resource as Order));
      } catch (error) {
        console.error('Error creating order in Cosmos DB:', error);
        this.localOrders.push(order);
        return stripUserId(order);
      }
    }
    this.localOrders.push(order);
    return stripUserId(order);
  }

  async updateOrderStatus(id: string, status: OrderStatus, userId?: string): Promise<Order | undefined> {
    if (this.isCosmosDbInitialized) {
      try {
        const { resource: existingOrder } = await this.ordersContainer!.item(id, id).read();
        if (!existingOrder) return undefined;

        if (userId && (existingOrder as Order).userId !== userId) {
          return undefined;
        }

        const updatedOrder = { ...existingOrder, status };
        const { resource } = await this.ordersContainer!.item(id, id).replace(updatedOrder);
        return stripUserId(stripUnderscoreProps(resource as Order));
      } catch (error) {
        console.error(`Error updating order ${id} in Cosmos DB:`, error);
        const orderIndex = this.localOrders.findIndex((order) => order.id === id);
        if (orderIndex === -1) return undefined;

        const order = this.localOrders[orderIndex];
        if (userId && order.userId !== userId) {
          return undefined;
        }

        this.localOrders[orderIndex] = { ...order, status };
        return stripUserId(this.localOrders[orderIndex]);
      }
    }
    const orderIndex = this.localOrders.findIndex((order) => order.id === id);
    if (orderIndex === -1) return undefined;

    const order = this.localOrders[orderIndex];
    if (userId && order.userId !== userId) {
      return undefined;
    }

    this.localOrders[orderIndex] = { ...order, status };
    return stripUserId(this.localOrders[orderIndex]);
  }

  async deleteOrder(id: string, userId?: string): Promise<boolean> {
    if (this.isCosmosDbInitialized) {
      try {
        const { resource: existingOrder } = await this.ordersContainer!.item(id, id).read();
        if (!existingOrder) return false;

        if (userId && (existingOrder as Order).userId !== userId) {
          return false;
        }

        await this.ordersContainer!.item(id, id).delete();
        return true;
      } catch (error) {
        console.error(`Error deleting order ${id} from Cosmos DB:`, error);
        const orderIndex = this.localOrders.findIndex((order) => order.id === id);
        if (orderIndex === -1) return false;

        const order = this.localOrders[orderIndex];
        if (userId && order.userId !== userId) {
          return false;
        }

        this.localOrders.splice(orderIndex, 1);
        return true;
      }
    }
    const orderIndex = this.localOrders.findIndex((order) => order.id === id);
    if (orderIndex === -1) return false;

    const order = this.localOrders[orderIndex];
    if (userId && order.userId !== userId) {
      return false;
    }

    this.localOrders.splice(orderIndex, 1);
    return true;
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined> {
    if (this.isCosmosDbInitialized) {
      try {
        const { resource: existingOrder } = await this.ordersContainer!.item(id, id).read();
        if (!existingOrder) return undefined;

        const updatedOrder = { ...existingOrder, ...updates };
        const { resource } = await this.ordersContainer!.item(id, id).replace(updatedOrder);
        return stripUserId(stripUnderscoreProps(resource as Order));
      } catch (error) {
        console.error(`Error updating order ${id} in Cosmos DB:`, error);
        const orderIndex = this.localOrders.findIndex((order) => order.id === id);
        if (orderIndex === -1) return undefined;

        this.localOrders[orderIndex] = { ...this.localOrders[orderIndex], ...updates };
        return stripUserId(this.localOrders[orderIndex]);
      }
    }
    const orderIndex = this.localOrders.findIndex((order) => order.id === id);
    if (orderIndex === -1) return undefined;

    this.localOrders[orderIndex] = { ...this.localOrders[orderIndex], ...updates };
    return stripUserId(this.localOrders[orderIndex]);
  }

  // User methods
  async createUser(id: string, name: string): Promise<void> {
    if (!this.usersContainer) {
      console.warn('Users container not initialized. User creation skipped.');
      return;
    }

    try {
      await this.usersContainer.items.create({
        id,
        name,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error creating user:', error);
    }
  }

  async getUserName(id: string): Promise<string | undefined> {
    if (!this.usersContainer) {
      console.warn('Users container not initialized. Cannot fetch user name.');
      return undefined;
    }

    try {
      const { resource } = await this.usersContainer.item(id, id).read();
      return resource?.name;
    } catch (error) {
      console.error('Error fetching user:', error);
      return undefined;
    }
  }

  async userExists(id: string): Promise<boolean> {
    if (!this.usersContainer) {
      console.warn('Users container not initialized. Assuming user exists.');
      return true; // Fallback to allowing operation
    }

    try {
      const { resource } = await this.usersContainer.item(id, id).read();
      return !!resource;
    } catch (error) {
      console.error('Error checking user existence:', error);
      return false;
    }
  }

  async getRegisteredUsers(): Promise<number> {
    if (!this.usersContainer) {
      console.warn('Users container not initialized. Cannot count registered users.');
      return 0;
    }

    try {
      const querySpec = {
        query: 'SELECT VALUE COUNT(1) FROM c',
      };
      const { resources } = await this.usersContainer.items.query(querySpec).fetchAll();
      return resources[0] || 0;
    } catch (error) {
      console.error('Error counting registered users:', error);
      return 0;
    }
  }

  // Initialize local data from JSON files
  protected initializeLocalData(): void {
    this.localBurgers = burgersData as Burger[];
    this.localToppings = toppingsData as Topping[];
  }
}
