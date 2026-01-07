import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Expose environment variables to the client
process.env.VITE_AGENT_API_URL = process.env.AGENT_API_URL_OVERRIDE ?? '';
console.log(`Using chat API base URL: "${process.env.VITE_AGENT_API_URL}"`);

export default defineConfig({
  build: {
    outDir: './dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        nested: resolve(__dirname, 'register.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:7071',
    },
  },
});
