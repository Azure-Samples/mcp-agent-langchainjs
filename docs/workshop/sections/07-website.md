TODO: fix SW CLI work + docs

<div class="info" data-title="Skip notice">

> If you want to skip the Chat website implementation and jump directly to the next section, run this command in the terminal **at the root of the project** to get the completed code directly:
> ```bash
> curl -fsSL https://github.com/Azure-Samples/azure-openai-rag-workshop/releases/download/latest/frontend.tar.gz | tar -xvz
> ```

<div>

## Agent website

Now that we have our Agent API, it's time to complete the website that will use it.

### Introducing Vite and Lit

We'll use [Vite](https://vitejs.dev/) as a frontend build tool, and [Lit](https://lit.dev/) as a Web components library.

This frontend will be built as a Single Page Application (SPA), which will be similar to the well-known ChatGPT website. The main difference is that it will get its reponse from the Agent API that we built in the previous section.

The project is available in the `packages/agent-webapp` folder. From the project directory, you can run this command to start the development server:

```bash
cd packages/agent-webapp
npm run dev
```

This will start the application in development mode. Click on [http://localhost:4280](http://localhost:4280) in the console to view it in the browser.

<div class="tip" data-title="Tip">

> In development mode, the Web page will automatically reload when you make any change to the code. We recommend you to keep this command running in the background, and then have two windows side-by-side: one with your IDE where you will edit the code, and one with your Web browser where you can see the final result.

</div>

<!-- <div class="info" data-title="Note">

> TODO codespaces explain port forwarding and ports tab

</div> -->

### The chat web component

We already built a chat web component for you, so you can focus on connecting the chat API. The nice thing about web components is that they are just HTML elements, so you can use them in any framework, or even without a framework, just like we do in this workshop.

As a result, you can re-use this component in your own projects, and customize it if needed.

The component is located in the `src/components/chat.ts` file, if you're curious about how it works.

If you want to customize the component, you can do it by editing the `src/components/chat.ts` file. The various HTML rendering methods are called `renderXxx`, for example here's the `renderLoader` method that is used to display the spinner while the answer is loading:

```ts
protected renderLoader = () =>
  this.isLoading && !this.isStreaming
    ? html`
        <div class="message assistant loader">
          <div class="message-body">
            ${this.currentStep ? html`<div class="current-step">${this.getCurrentStepTitle()}</div>` : nothing}
            <slot name="loader"><div class="loader-animation"></div></slot>
            <div class="message-role">${this.options.strings.assistant}</div>
          </div>
        </div>
      `
    : nothing;
```

### Calling the agent API

Now we need to call the agent API we created earlier. For this, we need to edit the `src/api.ts` file and complete the code where the  `TODO` comment is:

```ts
// TODO: complete call to the agent API
// const response =
```

Here you can use the [Fetch Web API](https://developer.mozilla.org/docs/Web/API/Fetch_API/Using_Fetch) to call your chat API. The URL of the API is already available in the `apiUrl` property.

In the body of the request, you should pass a JSON string containing the messages located in the `options.messages` property.

Now it's your turn to complete the code! 🙂

We'll handle the errors and parsing of the stream response after, so for now just focus on sending the request.

<details>
<summary>Click here to see an example solution</summary>

```ts
  const response = await fetch(`${apiUrl}/api/chats/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: options.messages,
      context: options.context || {},
    }),
  });
```

</details>

This method will be called from the Web component, in the `onSendClicked` method.

### Handling errors

We have the API call ready, but we still need to handle errors. For example, if the API is not reachable, or if it returns an error status code.

To do this, we can check the `response.ok` property after the fetch call, and the HTTP status code in the `response.status` property.

Add the following code after the fetch call to handle errors:

```ts
  if (response.status > 299 || !response.ok) {
    let json: JSON | undefined;
    try {
      json = await response.json();
    } catch {}

    const error = json?.['error'] ?? response.statusText;
    throw new Error(error);
  }
```

If we get an error, we still try to parse the response body as JSON to get a more detailed error message. If that fails, we just use the status text as the error message.

### Parsing the streaming response

Now that we have the error handling in place, we need parse the streaming response from the API. Streamed HTTP responses are a bit different that plain JSON responses, because the data is sent in chunks that can split during the transport and buffering, so we need to re-assemble them before we can parse the JSON.

Let's complete the `getCompletion()` first, we'll take care of the streaming after that.

Add this code after the error handling:

```ts
  return getChunksFromResponse<AIChatCompletionDelta>(response);
```

#### Parsing the stream

Now we'll implement the `getChunksFromResponse` function to turn the stream into a series of JSON objects.

Add this function at the bottom of the `src/api.ts` file:

```ts
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
```

Let's break down what this function does:
1. First, notice that we're using an async generator function again, so we can yield multiple values over time and create our stream of JSON objects.
2. We use the stream transform API to first decode the response body as text, and then parse it as NDJSON (Newline Delimited JSON). Since there's no built-in NDJSON parser in the browser, we'll implement our own after this.
3. We get a reader from the transformed stream, and read the value it returns (the JSON chunks). Finally, we yield each chunk converted to the type we expect, in our case `AIChatCompletionDelta`.

#### Implementing the NDJSON transformer

The last piece of the puzzle is to implement the `NdJsonParserStream` class that will transform a stream of text into a stream of JSON objects.

Add this class before the `getChunksFromResponse` function:

```ts
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
```

This class extends the `TransformStream` interface, to transform text (`string`) into JSON. The important part here is the `transform` method, which is called for each chunk of text received.

Because the chunks can be split in the middle of a JSON object, we need to buffer the incoming text until we can parse a complete JSON object. NDJSON objects are separated by newlines, so we split the incoming text by `\n`, and recombine each pice until we can successfully parse a JSON object. We emit the resulting object, clear the buffer and continue.

### Testing the completed website

Keep the webapp server running, and make sure that your agent API and MCP server are also running.

You can now open [http://localhost:4280](http://localhost:4280) in your browser to see the chat website, and try sending questions to your agent.

![Screenshot of the chat interface](./assets/chat-interface.png)

If everything is working correctly, you should see the agent answering alternating between `Thinking...`, tools calls, beforing finally giving the final answer.

![Screenshot of the agent answer](./assets/agent-answer.png)
