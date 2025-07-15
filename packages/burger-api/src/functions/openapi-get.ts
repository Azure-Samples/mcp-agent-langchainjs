import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import process from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import dotenv from 'dotenv';

// Env file is located in the root of the repository
dotenv.config({ path: path.join(process.cwd(), "../../.env") });

app.http('openapi-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'openapi',
  handler: async (request: HttpRequest, context: InvocationContext) => {
    context.log('Processing request to get OpenAPI specification...');

    try {
      const openapiPath = path.join(process.cwd(), 'openapi.yaml');
      const openapiContent = await fs.readFile(openapiPath, 'utf8');

      // Replace BURGER_API_HOST placeholder with actual host URL
      console.log('BURGER_API_URL:', process.env.BURGER_API_URL);
      context.log('Replacing <BURGER_API_HOST> in OpenAPI specification...');
      const burgerApiHost = process.env.BURGER_API_URL || 'http://localhost:7071';
      const processedContent = openapiContent.replace('<BURGER_API_HOST>', burgerApiHost);

      const url = new URL(request.url);
      const wantsJson =
        url.searchParams.get('format')?.toLowerCase() === 'json' ||
        (request.headers.get('accept')?.toLowerCase().includes('json') ?? false);

      if (wantsJson) {
        try {
          const json = yaml.load(processedContent);
          return {
            jsonBody: json,
            headers: {
              'Content-Type': 'application/json'
            },
            status: 200
          };
        } catch (err) {
          context.error('YAML to JSON conversion failed:', err);
          return {
            jsonBody: { error: 'YAML to JSON conversion failed.' },
            status: 500
          };
        }
      }

      return {
        body: processedContent,
        headers: {
          'Content-Type': 'text/yaml'
        },
        status: 200
      };
    } catch (error) {
      context.error('Error reading OpenAPI specification file:', error);

      return {
        jsonBody: { error: 'Error reading OpenAPI specification' },
        status: 500
      };
    }
  }
});
