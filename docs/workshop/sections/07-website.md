TODO: WIP

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

This frontend will be built as a Single Page Application (SPA), which will be similar to the well-known ChatGPT website. The main difference is that it will get its data from the Agent API that we built in the previous section.

The project is available in the `packages/agent-webapp` folder. From the project directory, you can run this command to start the development server:

```bash
cd packages/agent-webapp
npm run dev
```

This will start the application in development mode. Open [http://localhost:8000](http://localhost:8000) to view it in the browser.

<div class="tip" data-title="Tip">

> In development mode, the Web page will automatically reload when you make any change to the code. We recommend you to keep this command running in the background, and then have two windows side-by-side: one with your IDE where you will edit the code, and one with your Web browser where you can see the final result.

</div>

### The chat web component

We already built a chat web component for you, so you can focus on connecting the chat API. The nice thing about web components is that they are just HTML elements, so you can use them in any framework, or even without a framework, just like we do in this workshop.

As a result, you can re-use this component in your own projects, and customize it if needed.

The component is located in the `packages/agent-webapp/src/components/chat.ts` file, if you're curious about how it works.

If you want to customize the component, you can do it by editing the `packages/agent-webapp/src/components/chat.ts` file. The various HTML rendering methods are called `renderXxx`, for example here's the `renderLoader` method that is used to display the spinner while the answer is loading:

```ts
protected renderLoader = () => {
  return this.isLoading && !this.isStreaming
    ? html`
        <div class="message assistant loader">
          <div class="message-body">
            <slot name="loader"><div class="loader-animation"></div></slot>
            <div class="message-role">${this.options.strings.assistant}</div>
          </div>
        </div>
      `
    : nothing;
};
```

### Calling the chat API

Now we need to call the chat API we created earlier. For this, we need to edit the `src/frontend/src/api.ts` file and complete the code where the  `TODO` comment is:

```ts
// TODO: complete call to Chat API here
// const response =
```

Here you can use the [Fetch Web API](https://developer.mozilla.org/docs/Web/API/Fetch_API/Using_Fetch) to call your chat API. The URL of the API is already available in the `apiUrl` property.

In the body of the request, you should pass a JSON string containing the messages located in the `options.messages` property.

Now it's your turn to complete the code! 🙂

<details>
<summary>Click here to see an example solution</summary>

```ts
const response = await fetch(`${apiUrl}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: options.messages,
  }),
});
```

</details>

This method will be called from the Web component, in the `onSendClicked` method.

### Testing the completed website

Once you completed the code, you also need to run the backend to be able to test the application. Keep your frontend server running, and open a new terminal. Run this command from the project root to restart the backend services:

```bash
docker compose up
```

Now go back to your browser, and send a question to the chatbot. You should see the answer appear in the chat window.

![Screenshot of the chatbot answer](./assets/chatbot-answer.png)
