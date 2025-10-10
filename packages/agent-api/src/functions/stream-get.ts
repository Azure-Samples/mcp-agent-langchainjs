import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createWriteStream } from 'fs';
import { Writable } from 'stream';

app.setup({ enableHttpStream: true });

app.http('test', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async function (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const writeStream = createWriteStream('test.txt');
    await request.body?.pipeTo(Writable.toWeb(writeStream));

    for (let i = 0; i < 10; i++) {
      context.log(`Processing chunk ${i + 1}/10`);
      writeStream.write(`Chunk ${i + 1}\n`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    context.log('Processing complete');

    return { body: 'Done!' };
  },
});
