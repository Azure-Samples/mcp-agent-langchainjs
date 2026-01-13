import http, { type OutgoingHttpHeaders, type RequestOptions } from 'node:http';
import https from 'node:https';
import express, { type Request, type Response } from 'express';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import 'dotenv/config';

const targetEndpoints = process.env.AZURE_OPENAI_API_ENDPOINTS ?? process.env.AZURE_OPENAI_API_ENDPOINT;
const port = Number(process.env.PORT ?? 3000);

if (!targetEndpoints) {
  throw new Error('AZURE_OPENAI_API_ENDPOINTS (or AZURE_OPENAI_API_ENDPOINT) is not set.');
}

const endpointBases = parseEndpointBases(targetEndpoints);

console.log(
  `Using Azure OpenAI endpoints (round-robin): ${endpointBases.map((endpoint) => endpoint.toString()).join(', ')}`,
);

const credential = new DefaultAzureCredential();
const getToken = getBearerTokenProvider(credential, 'https://cognitiveservices.azure.com/.default');

let endpointIndex = 0;
function getNextEndpointBase(): URL {
  const endpointBase = endpointBases[endpointIndex];
  endpointIndex = (endpointIndex + 1) % endpointBases.length;
  return endpointBase;
}

const app = express();
app.disable('x-powered-by');

async function forwardRequest(request: Request, response: Response) {
  const targetUrl = new URL(request.originalUrl, getNextEndpointBase());
  const headers = await forwardRequestHeaders(request, targetUrl);

  const requestOptions: RequestOptions = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port || undefined,
    method: request.method,
    path: `${targetUrl.pathname}${targetUrl.search}`,
    headers,
  };

  const proxyRequest = (targetUrl.protocol === 'https:' ? https : http).request(requestOptions, (proxyResponse) => {
    response.status(proxyResponse.statusCode ?? 502);

    applyProxyResponseHeaders(response, proxyResponse.headers);

    proxyResponse.pipe(response);
  });

  proxyRequest.on('error', (error) => {
    console.error('Azure OpenAI proxy request failed', error);

    if (response.headersSent) {
      response.end();
    } else {
      response.status(502).json({ error: 'Failed to forward request to Azure OpenAI.' });
    }
  });

  request.pipe(proxyRequest);
}

app.get('/', (_request: Request, response: Response) => {
  response.send('Azure OpenAI Proxy is running.');
});

app.all('/*path', forwardRequest);

app.listen(port, () => {
  console.log(`Azure OpenAI proxy listening on port ${port}`);
});

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function parseHeaderTokens(value: string | string[] | undefined): Set<string> {
  if (!value) {
    return new Set();
  }

  const combined = Array.isArray(value) ? value.join(',') : value;
  return new Set(
    combined
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean),
  );
}

function shouldSkipHeader(name: string, connectionTokens: Set<string>): boolean {
  const normalized = name.toLowerCase();
  return HOP_BY_HOP_HEADERS.has(normalized) || connectionTokens.has(normalized);
}

async function forwardRequestHeaders(request: Request, targetUrl: URL): Promise<OutgoingHttpHeaders> {
  const headers: OutgoingHttpHeaders = {};
  const connectionTokens = parseHeaderTokens(request.headers.connection);

  // Preserve incoming headers except the ones we are required to override.
  for (const [key, value] of Object.entries(request.headers)) {
    const normalizedKey = key.toLowerCase();

    if (!value || normalizedKey === 'authorization' || normalizedKey === 'api-key') {
      continue;
    }

    if (shouldSkipHeader(normalizedKey, connectionTokens)) {
      continue;
    }

    headers[normalizedKey] = value;
  }

  // Refresh token and set authentication headers
  const accessToken = await getToken();

  headers['authorization'] = `Bearer ${accessToken}`;
  headers['api-key'] = accessToken;
  headers['host'] = targetUrl.host;

  return headers;
}

function applyProxyResponseHeaders(response: Response, proxyHeaders: OutgoingHttpHeaders) {
  const connectionTokens = parseHeaderTokens(
    typeof proxyHeaders.connection === 'number' ? String(proxyHeaders.connection) : proxyHeaders.connection,
  );

  for (const [key, value] of Object.entries(proxyHeaders)) {
    if (value === undefined) {
      continue;
    }

    const normalizedKey = key.toLowerCase();
    if (shouldSkipHeader(normalizedKey, connectionTokens)) {
      continue;
    }

    response.setHeader(normalizedKey, value);
  }
}

function parseEndpointBases(value: string): URL[] {
  const endpoints = value
    .split(',')
    .map((endpoint) => endpoint.trim())
    .filter(Boolean);

  if (endpoints.length === 0) {
    throw new Error('AZURE_OPENAI_API_ENDPOINTS (or AZURE_OPENAI_API_ENDPOINT) does not contain any endpoints.');
  }

  const bases: URL[] = [];
  for (const endpoint of endpoints) {
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      throw new Error(`Invalid Azure OpenAI endpoint URL: ${endpoint}`);
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error(`Invalid Azure OpenAI endpoint protocol (expected http/https): ${endpoint}`);
    }

    bases.push(url);
  }

  return bases;
}
