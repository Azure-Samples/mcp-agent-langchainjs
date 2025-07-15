---
applyTo: 'packages/*-webapp/**'
---

## Guidance for Code Generation

- The webapp is built using Lit v3 components and TypeScript
- Vite is the app bundler
- The webapp is hosted on Azure Static Web Apps
- Do not add extra dependencies to the project without asking first
- Use `npm` as package manager
- Each component should have its own file
- Never use `null` if possible, use `undefined` instead
- Use `fetch` for API calls
- Use `async/await` for asynchronous code
- Keep the HTML and CSS code as clean as possible
- Lit components should be in the `src/components` folder
- Shared services should be save as `src/*.service.ts` files
- Re-export all components in `src/index.ts` file
- Use latest CSS features such as nesting and custom properties

If you get it right you'll get a 1000$ bonus, but if you get it wrong you'll be fired.
