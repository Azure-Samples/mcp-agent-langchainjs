import http, { type OutgoingHttpHeaders, type RequestOptions } from 'node:http';
import https from 'node:https';
import express, { type Request, type Response } from 'express';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import 'dotenv/config';

const targetEndpoint = process.env.AZURE_OPENAI_API_ENDPOINT;
const port = Number(process.env.PORT ?? 3000);

if (!targetEndpoint) {
  throw new Error('AZURE_OPENAI_API_ENDPOINT is not set.');
}

console.log(`Using OpenAI at: ${targetEndpoint}`);

const credential = new DefaultAzureCredential();
const getToken = getBearerTokenProvider(credential, 'https://cognitiveservices.azure.com/.default');

const endpointBase = new URL(targetEndpoint);
const app = express();
app.disable('x-powered-by');

async function forwardRequest(req: Request, res: Response) {
  const targetUrl = new URL(req.originalUrl, endpointBase);
  const headers = await forwardRequestHeaders(req, targetUrl);

  const requestOptions: RequestOptions = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port || undefined,
    method: req.method,
    path: `${targetUrl.pathname}${targetUrl.search}`,
    headers,
  };

  const proxyRequest = (targetUrl.protocol === 'https:' ? https : http).request(
    requestOptions,
    (proxyResponse) => {
      res.status(proxyResponse.statusCode ?? 502);

      applyProxyResponseHeaders(res, proxyResponse.headers);

      proxyResponse.pipe(res);
    },
  );

  proxyRequest.on('error', (error) => {
    console.error('Azure OpenAI proxy request failed', error);

    if (!res.headersSent) {
      res.status(502).json({ error: 'Failed to forward request to Azure OpenAI.' });
    } else {
      res.end();
    }
  });

  req.pipe(proxyRequest);
}

app.get('/', (_req: Request, res: Response) => {
  res.send('Azure OpenAI Proxy is running.');
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

async function forwardRequestHeaders(req: Request, targetUrl: URL): Promise<OutgoingHttpHeaders> {
  const headers: OutgoingHttpHeaders = {};
  const connectionTokens = parseHeaderTokens(req.headers.connection);

  // Preserve incoming headers except the ones we are required to override.
  for (const [key, value] of Object.entries(req.headers)) {
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
  headers['host'] = targetUrl.host;

  return headers;
}

function applyProxyResponseHeaders(res: Response, proxyHeaders: OutgoingHttpHeaders) {
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

    res.setHeader(normalizedKey, value);
  }
}
