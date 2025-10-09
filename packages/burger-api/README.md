<div align="center">

# Burger API (Azure Functions)

[![Open project in GitHub Codespaces](https://img.shields.io/badge/Codespaces-Open-blue?style=flat-square&logo=github)](https://codespaces.new/Microsoft/mcp-agent-langchainjs?hide_repo_select=true&ref=main&quickstart=true)
![Node version](https://img.shields.io/badge/Node.js->=20-3c873a?style=flat-square)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

[Overview](#overview) • [API Endpoints](#api-endpoints) • [Development](#development)

</div>

## Overview

This is the Burger API, a serverless API that allows you to order delicious burgers with various toppings. The API is designed to be simple and easy to use, providing endpoints for accessing burger and topping information, placing orders, and managing your burger experience.

The API is built with [Azure Functions](https://learn.microsoft.com/azure/azure-functions/functions-overview?pivots=programming-language-javascript).

<div align="center">
  <img src="../../docs/images/burger-architecture.drawio.png" alt="Service architecture" />
</div>

## API Endpoints

The Burger API provides the following endpoints:

| Method | Path                     | Description                                                                                                                                  |
| ------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /api                     | Returns basic server status information including active and total orders                                                                    |
| GET    | /api/openapi             | Returns the OpenAPI specification in YAML format (add `?format=json` for JSON)                                                               |
| GET    | /api/burgers             | Returns a list of all burgers                                                                                                                |
| GET    | /api/burgers/{id}        | Retrieves a specific burger by its ID                                                                                                        |
| GET    | /api/toppings            | Returns a list of all toppings (can be filtered by category with `?category=X`)                                                                |
| GET    | /api/toppings/{id}       | Retrieves a specific topping by its ID                                                                                                       |
| GET    | /api/toppings/categories | Returns a list of all topping categories                                                                                                     |
| GET    | /api/orders              | Returns a list of all orders in the system                                                                                                   |
| POST   | /api/orders              | Places a new order with burgers (requires `userId`, optional `nickname`)                                                                                          |
| GET    | /api/orders/{orderId}    | Retrieves an order by its ID                                                                                                                 |
| DELETE | /api/orders/{orderId}    | Cancels an order if it has not yet been started (status must be 'pending', requires `userId` as a query parameter (e.g., `?userId={userId}`) |
| GET    | /api/images/{filepath}   | Retrieves image files (e.g., /api/images/burgers/burger-1.jpg)                                                                                       |

### Filtering orders

The `GET /api/orders` endpoint supports the following optional query parameters:

- `userId`: Filter orders by user ID.
- `status`: Filter by order status. You can provide multiple statuses as a comma-separated list (e.g. `pending,ready`).
- `last`: Filter orders created in the last X minutes or hours (e.g. `last=60m` for 60 minutes, `last=2h` for 2 hours).

**Note:** The `userId` property is never included in any order response for privacy reasons.

**Examples:**

```
GET /api/orders?userId=user123
GET /api/orders?status=pending,ready
GET /api/orders?last=2h
GET /api/orders?userId=user123&status=completed&last=60m
```

You can view the complete API documentation by opening the [Swagger Editor](https://editor.swagger.io/?url=http://localhost:7071/api/openapi) or the [OpenAPI YAML file](http://localhost:7071/api/openapi).

### Order Limits

A user can have a maximum of **5 active orders** (status: `pending` or `in-preparation`) at a time. Additionally, a single order cannot exceed **50 burgers** in total across all items.

These limits ensure fair use and prevent abuse.

### Order Status Automation

Order statuses are updated automatically by a timer function every 40 seconds:

- Orders move from 'pending' to 'in-preparation' 1-3 minutes after creation.
- Orders move from 'in-preparation' to 'ready' within 3 minutes around their estimated completion time. When an order is ready, the `readyAt` property is set to the ready timestamp (ISO date string).
- Orders move from 'ready' to 'completed' 1-2 minutes after being ready. When an order is completed, the `completedAt` property is set to the completion timestamp (ISO date string).

Estimated completion time is calculated as:

- 3-5 minutes for 1-2 burgers, plus 1 minute for each additional burger.

No manual API call is needed for these transitions.

## Development

### Getting started

Follow the instructions [here](../../README.md#getting-started) to set up the development environment for the entire Burger MCP Agents project.

### Run the application

Use the following command to run the application locally:

```bash
npm start
```

This command will start the Azure Functions application locally. You can test the endpoints by opening the file `api.http` and click on **Send Request** to test the endpoints.

> [!NOTE]
> If you have not deployed the Azure resources, it will fall back to in-memory data. You can test the API without deploying it to Azure.

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start the development server with hot reload and Azurite storage emulator |
| `npm run build` | Build the TypeScript source |
| `npm run clean` | Clean build artifacts |
| `npm run start:storage` | Start local Azurite storage emulator |
| `update:local-settings` | Create or update `local.settings.json` needed by the Functions runtime |

### Configuration

The application uses environment variables for configuration:

| Variable | Description | Default |
|----------|-------------|---------|
| `AZURE_COSMOSDB_NOSQL_ENDPOINT` | Azure Cosmos DB endpoint | `""` (not set) |
| `AZURE_STORAGE_URL` | Azure Storage URL for images | `""` (not set) |
| `AZURE_STORAGE_CONTAINER_NAME` | Azure Storage container name for images | `""` (not set) |

> [!NOTE]
> When running locally without any configuration set, the API will automatically use in-memory storage for the database and file access for the images, and log this behavior.
