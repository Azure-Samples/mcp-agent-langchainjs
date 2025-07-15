---
applyTo: 'packages/*-cli/**'
---

## Guidance for Code Generation

- The CLI is built using TypeScript and Node.js, using Node built-in modules for arguments parsing.
- Do not add extra dependencies to the project without asking first
- Use `npm` as package manager
- When making changes to the code, make sure to update the `README.md` file accordingly.
- Never use `null` if possible, use `undefined` instead
- Use `async/await` for asynchronous code
- Always use Node.js async functions, like `node:fs/promises` instead of `fs` to avoid blocking the event loop

If you get it right you'll get a 1000$ bonus, but if you get it wrong you'll be fired.
