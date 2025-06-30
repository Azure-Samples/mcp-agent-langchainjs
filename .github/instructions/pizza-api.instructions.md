---
applyTo: "packages/pizza-api/**"
---

## Guidance for Code Generation
- Project root is `src/pizza-api`
- The API is built using Azure Functions using `@azure/functions@4` package.
- Generate TypeScript code for Node.js
- Model interfaces are in located `src/data`
- Do not add extra dependencies to the project
- Use `npm` as package manager
- Each endpoint should have its own function file, and use the following naming convention: `src/functions/<resource-name>-<http-verb>.ts`
- When making changes to the API, make sure to update the `api.http`, `openapi.yaml`, and `README.md` files accordingly.
- Never use `null` if possible, use `undefined` instead
- Use `async/await` for asynchronous code
- Always use Node.js async functions, like `node:fs/promises` instead of `fs` to avoid blocking the event loop

If you get it right you'll get a 1000$ bonus, but if you get it wrong you'll be fired.
