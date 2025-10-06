import { type AIChatMessage, type AIChatCompletionDelta } from '../models.js';

export const apiBaseUrl: string = import.meta.env.VITE_API_URL || '';

export type ChatRequestOptions = {
  messages: AIChatMessage[];
  context?: Record<string, unknown>;
  apiUrl: string;
};

export async function getCompletion(options: ChatRequestOptions) {
  const apiUrl = options.apiUrl || apiBaseUrl;
  const response = await fetch(`${apiUrl}/api/chats/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: options.messages,
      context: options.context || {},
    }),
  });

  if (response.status > 299 || !response.ok) {
    let json: JSON | undefined;
    try {
      json = await response.json();
    } catch {}

    const error = json?.['error'] ?? response.statusText;
    throw new Error(error);
  }

  return getChunksFromResponse<AIChatCompletionDelta>(response);
}

class NdJsonParserStream extends TransformStream<string, JSON> {
  private buffer = '';
  constructor() {
    let controller: TransformStreamDefaultController<JSON>;
    super({
      start(_controller) {
        controller = _controller;
      },
      transform: (chunk) => {
        const jsonChunks = chunk.split('\n').filter(Boolean);
        for (const jsonChunk of jsonChunks) {
          try {
            this.buffer += jsonChunk;
            controller.enqueue(JSON.parse(this.buffer));
            this.buffer = '';
          } catch {
            // Invalid JSON, wait for next chunk
          }
        }
      },
    });
  }
}

export async function* getChunksFromResponse<T>(response: Response): AsyncGenerator<T, void> {
  const reader = response.body?.pipeThrough(new TextDecoderStream()).pipeThrough(new NdJsonParserStream()).getReader();
  if (!reader) {
    throw new Error('No response body or body is not readable');
  }

  let value: JSON | undefined;
  let done: boolean;
  // eslint-disable-next-line no-await-in-loop
  while ((({ value, done } = await reader.read()), !done)) {
    const chunk = value as T;
    yield chunk;
  }
}
