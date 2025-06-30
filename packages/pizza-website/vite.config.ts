import { defineConfig } from 'vite';

// Expose environment variables to the client
process.env.VITE_PIZZA_API_URL = process.env.PIZZA_API_URL ?? '';
console.log(`Using pizza API base URL: "${process.env.VITE_PIZZA_API_URL}"`);

export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:7071',
    },
  },
});
