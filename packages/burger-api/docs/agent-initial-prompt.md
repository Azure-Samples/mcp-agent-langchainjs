
## Goal
I want to create a burger API using Azure Functions. 

## Endpoints
The API should provide endpoints for:
- Listing current orders with their status
- Creating a new order
- Cancelling an order that has not been started yet
- List available burgers on the menu with their prices and ingredients
- List available extra ingredients with their prices

Each endpoint should have its own function file, and use the following naming convention:
- `src/functions/<resource-name>-<http-verb>.ts`

## Menu items
Each menu item has a unique ID, a category, a name, a description, a price and for burgers a list of toppings.

## Order status
- `pending`: Order has been created but not yet started
- `in-preparation`: Order is being prepared
- `ready`: Order is ready for pickup
- `completed`: Order has been picked up
- `cancelled`: Order has been cancelled

Each order have a unique ID, a creation date, a list of menu items ordered with their quantity with optional sub-items, an estimated time for preparation, total price and a status.

## Tech details
- Project root is `samples/burger-api`
- The API is built using Azure Functions using `@azure/functions@4` package.
- The code is in TypeScript
- Model interfaces are in `src/data`
- Do not add extra dependencies to the project
- Use `npm` as package manager

