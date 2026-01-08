TODO: WIP

<div class="info" data-title="skip notice">

> This step is entirely optional, you can skip it if you want to jump directly to the next section.

</div>

## Optional improvements

We now have a working application, but there are still a few things we can improve to make it better, like adding a follow-up questions feature.

### Add follow-up questions

After your chatbot has answered the user's question, it can be useful to provide some follow-up questions to the user, to help them find the information they need.

In order to do that, we'll improve our original prompt. Open the file `src/backend/src/plugins/chat.ts` and add this below the system prompt:

```ts
const FOLLOW_UP_QUESTIONS_PROMPT = `Generate 3 very brief follow-up questions that the user would likely ask next.
Enclose the follow-up questions in double angle brackets. Example:
<<Am I allowed to invite friends for a party?>>
<<How can I ask for a refund?>>
<<What If I break something?>>

Do no repeat questions that have already been asked.
Make sure the last question ends with ">>".`;
```

Let's analyze this prompt to understand what's going on:

1. We ask the model to generate 3 follow-up questions: `Generate 3 very brief follow-up questions that the user would likely ask next.`
2. We specify the format of the follow-up questions: `Enclose the follow-up questions in double angle brackets.`
3. We use the few-shot approach to give examples of follow-up questions:
    ```
    <<Am I allowed to invite friends for a party?>>
    <<How can I ask for a refund?>>
    <<What If I break something?>>
    ```
4. Based on testing, we improve the prompt with more rules: `Do no repeat questions that have already been asked.` and `Make sure the last question ends with ">>".`

Now that we have our prompt, we need to add it to the system prompt.
Replace this line in the chat service:

```ts
const systemMessage = SYSTEM_MESSAGE_PROMPT;
```

with:

```ts
const systemMessage = SYSTEM_MESSAGE_PROMPT + FOLLOW_UP_QUESTIONS_PROMPT;
```

That's it!
You can now test your changes by running `npm start` at the root of the repository to start the application. This command will start both the backend and frontend in development mode, so you can test your changes.

In the chat webapp you should now see the follow-up questions after the answer:

![Screenshot of the follow-up questions](./assets/follow-up-questions.png)

You can now redeploy your improved backend by running `azd deploy backend` and test it in production.

### Implementing chat history

The current version of the chat API is using the `chat` endpoint to send the messages and get the response once the model has finished generating it. This creates longer wait times for the user, which is not ideal.

OpenAI API have an option to stream the response message, allowing to see the response as soon as it's generated. 
While it doesn't make the model generate the response faster, it allows you to display the response to the user faster so they can start reading it directly while it's being generated.
