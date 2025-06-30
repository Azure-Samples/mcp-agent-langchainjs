import { app, type HttpRequest, type InvocationContext } from '@azure/functions';
import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

app.http('openapi-get', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'openapi',
  handler: async (request: HttpRequest, context: InvocationContext) => {
    context.log('Processing request to get OpenAPI specification...');

    try {
      const openapiPath = path.join(__dirname, '../../../openapi.yaml');
      const openapiContent = await fs.readFile(openapiPath, 'utf8');

      const url = new URL(request.url);
      const wantsJson =
        url.searchParams.get('format')?.toLowerCase() === 'json' ||
        (request.headers.get('accept')?.toLowerCase().includes('json') ?? false);

      if (wantsJson) {
        try {
          const json = yaml.load(openapiContent);
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
        body: openapiContent,
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