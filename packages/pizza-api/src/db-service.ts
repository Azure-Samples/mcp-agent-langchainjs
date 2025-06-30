import path from 'node:path';
import { ToppingCategory } from './topping';
import { Pizza } from './pizza';
import { Topping } from './topping';
import { Order, OrderStatus } from './order';
import { Container, CosmosClient, Database } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import pizzasData from '../data/pizzas.json';
import toppingsData from '../data/toppings.json';
import dotenv from "dotenv";

// Env file is located in the root of the repository
dotenv.config({ path: path.join(__dirname, "../../../.env") });

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
    return orderOrOrders.map(order => {
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

// Database service for our pizza API using Azure Cosmos DB
export class DbService {
  private static instance: DbService;
  private client: CosmosClient | undefined = undefined;
  private database: Database | undefined = undefined;
  private pizzasContainer: Container | undefined = undefined;
  private toppingsContainer: Container | undefined = undefined;
  private ordersContainer: Container | undefined = undefined;
  private usersContainer: Container | undefined = undefined;
  
  // Fallback to local data if Cosmos DB is not available
  private localPizzas: Pizza[] = [];
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
        aadCredentials: credential
      });

      // Get or create database
      const databaseId = 'pizzaDB';
      const { database } = await this.client.databases.createIfNotExists({
        id: databaseId
      });
      this.database = database;

      // Get or create containers
      const { container: pizzasContainer } = await this.database.containers.createIfNotExists({
        id: 'pizzas',
        partitionKey: { paths: ['/id'] }
      });
      this.pizzasContainer = pizzasContainer;

      const { container: toppingsContainer } = await this.database.containers.createIfNotExists({
        id: 'toppings',
        partitionKey: { paths: ['/id'] }
      });
      this.toppingsContainer = toppingsContainer;

      const { container: ordersContainer } = await this.database.containers.createIfNotExists({
        id: 'orders',
        partitionKey: { paths: ['/id'] }
      });
      this.ordersContainer = ordersContainer;

      // Initialize connection to userDB as well to support user-related functions
      try {
        const userDbId = 'userDB';
        const { database: userDatabase } = await this.client.databases.createIfNotExists({
          id: userDbId
        });
        
        // Get or create users container
        const { container: usersContainer } = await userDatabase.containers.createIfNotExists({
          id: 'users',
          partitionKey: { paths: ['/id'] }
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
      // Check if Pizzas container is empty
      const pizzaIterator = this.pizzasContainer!.items.query('SELECT VALUE COUNT(1) FROM c');
      const pizzaCount = (await pizzaIterator.fetchAll()).resources[0];
      
      if (pizzaCount === 0) {
        console.log('Seeding pizzas data to Cosmos DB...');
        const pizzas = pizzasData as Pizza[];
        for (const pizza of pizzas) {
          await this.pizzasContainer!.items.create(pizza);
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

  // Pizza methods
  async getPizzas(): Promise<Pizza[]> {
    if (this.isCosmosDbInitialized) {
      try {
        const querySpec = {
          query: 'SELECT * FROM c'
        };
        const { resources } = await this.pizzasContainer!.items.query(querySpec).fetchAll();
        return (resources as Pizza[]).map(stripUnderscoreProps);
      } catch (error) {
        console.error('Error fetching pizzas from Cosmos DB:', error);
        return [...this.localPizzas];
      }
    }
    return [...this.localPizzas];
  }

  async getPizza(id: string): Promise<Pizza | undefined> {
    if (this.isCosmosDbInitialized) {
      try {
        const { resource } = await this.pizzasContainer!.item(id, id).read();
        return resource ? stripUnderscoreProps(resource as Pizza) : undefined;
      } catch (error) {
        console.error(`Error fetching pizza ${id} from Cosmos DB:`, error);
        return this.localPizzas.find(pizza => pizza.id === id);
      }
    }
    return this.localPizzas.find(pizza => pizza.id === id);
  }

  // Topping methods
  async getToppings(): Promise<Topping[]> {
    if (this.isCosmosDbInitialized) {
      try {
        const querySpec = {
          query: 'SELECT * FROM c'
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

  async getToppingsByCategory(category: ToppingCategory): Promise<Topping[]> {
    if (this.isCosmosDbInitialized) {
      try {
        const querySpec = {
          query: 'SELECT * FROM c WHERE c.category = @category',
          parameters: [
            {
              name: '@category',
              value: category
            }
          ]
        };
        const { resources } = await this.toppingsContainer!.items.query(querySpec).fetchAll();
        return (resources as Topping[]).map(stripUnderscoreProps);
      } catch (error) {
        console.error(`Error fetching toppings by category ${category} from Cosmos DB:`, error);
        return this.localToppings.filter(topping => topping.category === category);
      }
    }
    return this.localToppings.filter(topping => topping.category === category);
  }

  async getTopping(id: string): Promise<Topping | undefined> {
    if (this.isCosmosDbInitialized) {
      try {
        const { resource } = await this.toppingsContainer!.item(id, id).read();
        return resource ? stripUnderscoreProps(resource as Topping) : undefined;
      } catch (error) {
        console.error(`Error fetching topping ${id} from Cosmos DB:`, error);
        return this.localToppings.find(topping => topping.id === id);
      }
    }
    return this.localToppings.find(topping => topping.id === id);
  }

  // Orders methods
  async getOrders(options?: {
    userId?: string;
    statuses?: string[];
    lastMs?: number;
  }): Promise<Order[]> {
    const { userId, statuses, lastMs } = options || {};
    if (this.isCosmosDbInitialized) {
      try {
        // Build Cosmos DB SQL query dynamically
        let query = 'SELECT * FROM c';
        const filters: string[] = [];
        const parameters: { name: string; value: any }[] = [];
        if (userId) {
          filters.push('c.userId = @userId');
          parameters.push({ name: '@userId', value: userId });
        }
        if (statuses && statuses.length > 0) {
          filters.push('ARRAY_CONTAINS(@statuses, LOWER(c.status))');
          parameters.push({ name: '@statuses', value: statuses.map(s => s.toLowerCase()) });
        }
        if (lastMs && lastMs > 0) {
          const since = new Date(Date.now() - lastMs).toISOString();
          filters.push('c.createdAt >= @since');
          parameters.push({ name: '@since', value: since });
        }
        if (filters.length > 0) {
          query += ' WHERE ' + filters.join(' AND ');
        }
        const querySpec = { query, parameters };
        const { resources } = await this.ordersContainer!.items.query(querySpec).fetchAll();
        return stripUserId((resources as Order[]).map(stripUnderscoreProps));
      } catch (error) {
        console.error('Error fetching orders from Cosmos DB:', error);
        // fallback to local
        return stripUserId(this.filterLocalOrders(userId, statuses, lastMs));
      }
    }
    return stripUserId(this.filterLocalOrders(userId, statuses, lastMs));
  }

  private filterLocalOrders(userId?: string, statuses?: string[], lastMs?: number): Order[] {
    let orders = [...this.localOrders];
    if (userId) {
      orders = orders.filter(order => order.userId === userId);
    }
    if (statuses && statuses.length > 0) {
      orders = orders.filter(order => statuses.includes(order.status.toLowerCase()));
    }
    if (lastMs && lastMs > 0) {
      const since = Date.now() - lastMs;
      orders = orders.filter(order => {
        const created = Date.parse(order.createdAt);
        return !isNaN(created) && created >= since;
      });
    }
    return orders;
  }

  async getOrder(id: string, withUserId = false): Promise<Order | undefined> {
    const processOrder = withUserId ? (order?: Order) => order : stripUserId;
    if (this.isCosmosDbInitialized) {
      try {
        const { resource } = await this.ordersContainer!.item(id, id).read();
        return processOrder(resource ? stripUnderscoreProps(resource as Order) : undefined);
      } catch (error) {
        console.error(`Error fetching order ${id} from Cosmos DB:`, error);
      }
    }
    return processOrder(this.localOrders.find(order => order.id === id));
  }

  async createOrder(order: Omit<Order, 'id'>): Promise<Order> {
    const id = Date.now().toString(); // Simple ID generation
    const newOrder: Order = {
      ...order,
      id,
      completedAt: undefined // always undefined on creation
    };

    if (this.isCosmosDbInitialized) {
      try {
        const { resource } = await this.ordersContainer!.items.create(newOrder);
        return stripUserId(resource ? stripUnderscoreProps(resource as Order) : newOrder);
      } catch (error) {
        console.error('Error creating order in Cosmos DB:', error);
        this.localOrders.push(newOrder);
        return stripUserId(newOrder);
      }
    }

    this.localOrders.push(newOrder);
    return stripUserId(newOrder);
  }

  async cancelOrder(id: string): Promise<Order | undefined> {
    if (this.isCosmosDbInitialized) {
      try {
        // First read the order to check its status
        const { resource: existingOrder } = await this.ordersContainer!.item(id, id).read();
        
        if (!existingOrder || existingOrder.status !== OrderStatus.Pending) {
          return undefined;
        }
        
        // Update the order status
        const updatedOrder = { ...existingOrder, status: OrderStatus.Cancelled };
        const { resource } = await this.ordersContainer!.item(id, id).replace(updatedOrder);
        return stripUserId(resource ? stripUnderscoreProps(resource as Order) : undefined);
      } catch (error) {
        console.error(`Error cancelling order ${id} in Cosmos DB:`, error);
        
        // Fall back to local data
        const orderIndex = this.localOrders.findIndex(order => order.id === id);
        if (orderIndex === -1) {
          return undefined;
        }

        const order = this.localOrders[orderIndex];
        if (order.status !== OrderStatus.Pending) {
          return undefined;
        }

        const updatedOrder = { ...order, status: OrderStatus.Cancelled };
        this.localOrders[orderIndex] = updatedOrder;
        return stripUserId(updatedOrder);
      }
    }

    // Handle with local data
    const orderIndex = this.localOrders.findIndex(order => order.id === id);
    if (orderIndex === -1) {
      return undefined;
    }

    const order = this.localOrders[orderIndex];
    if (order.status !== OrderStatus.Pending) {
      return undefined;
    }

    const updatedOrder = { ...order, status: OrderStatus.Cancelled };
    this.localOrders[orderIndex] = updatedOrder;
    return stripUserId(updatedOrder);
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined> {
    if (this.isCosmosDbInitialized) {
      try {
        const { resource: existingOrder } = await this.ordersContainer!.item(id, id).read();
        if (!existingOrder) return undefined;
        // If status is being set to completed, set completedAt if not already set
        let updatedOrder = { ...existingOrder, ...updates };
        if (updates.status === OrderStatus.Completed && !updatedOrder.completedAt) {
          updatedOrder.completedAt = new Date().toISOString();
        }
        const { resource } = await this.ordersContainer!.item(id, id).replace(updatedOrder);
        return stripUserId(resource ? stripUnderscoreProps(resource as Order) : undefined);
      } catch (error) {
        console.error(`Error updating order ${id} in Cosmos DB:`, error);
        // fallback to local
      }
    }
    const orderIndex = this.localOrders.findIndex(order => order.id === id);
    if (orderIndex === -1) return undefined;
    let updatedOrder = { ...this.localOrders[orderIndex], ...updates };
    if (updates.status === OrderStatus.Completed && !updatedOrder.completedAt) {
      updatedOrder.completedAt = new Date().toISOString();
    }
    this.localOrders[orderIndex] = updatedOrder;
    return stripUserId(updatedOrder);
  }

  // Initialize local mock data from JSON files
  protected initializeLocalData(): void {
    // Load pizzas
    this.localPizzas = pizzasData as Pizza[];
    
    // Load toppings
    this.localToppings = toppingsData as Topping[];
  }

  async userExists(userId: string): Promise<boolean> {
    if (!this.isCosmosDbInitialized) {
      // Don't check for user existence when running locally
      return true;
    }

    if (!this.usersContainer) {
      return false;
    }

    try {
      const querySpec = {
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.accessToken = @accessToken',
        parameters: [{ name: '@accessToken', value: userId }]
      };
      
      const { resources } = await this.usersContainer.items.query(querySpec).fetchAll();
      return resources[0] > 0;
    } catch (error) {
      console.error('Error checking if user exists:', error);
      return false;
    }
  }

  async getRegisteredUsers(): Promise<number> {
    if (!this.isCosmosDbInitialized || !this.usersContainer) {
      return 0;
    }

    try {
      const querySpec = {
        query: 'SELECT VALUE COUNT(1) FROM c'
      };
      
      const { resources } = await this.usersContainer.items.query(querySpec).fetchAll();
      return resources[0] || 0;
    } catch (error) {
      console.error('Error getting total number of registered users:', error);
      return 0;
    }
  }
}
