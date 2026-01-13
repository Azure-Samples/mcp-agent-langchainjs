<div class="info" data-title="skip notice">

> This step is entirely optional, you can skip it if you want to jump directly to the next section.

</div>

## Optional improvements

We now have a working application, but there are still a few things we can improve to make it better, like adding a follow-up questions feature.

### Add follow-up questions

After your agent has answered the user's question, it can be useful to provide some follow-up questions to the user, to help them find the information they need.

In order to do that, we'll improve our original prompt. Open the file `packages/agent-api/src/functions/chat-post.ts` and update the system prompt to include this under the `## Task` section:

```md
## Task
1. Help the user with their request, ask any clarifying questions if needed.
2. ALWAYS generate 3 very brief follow-up questions that the user would likely ask next, as if you were the user.
Enclose the follow-up questions in double angle brackets. Example:
<<Do you have vegan options?>>
<<How can I cancel my order?>>
<<What are the available sauces?>>
Make sure the last question ends with ">>", and phrase the questions as if you were the user, not the assistant.
```

Let's analyze this prompt to understand what's going on:

1. We ask the model to generate 3 follow-up questions: `Generate 3 very brief follow-up questions that the user would likely ask next.`
2. We specify the format of the follow-up questions: `Enclose the follow-up questions in double angle brackets.`
3. We use the few-shot approach to give examples of follow-up questions:
    ```
    <<Do you have vegan options?>>
    <<How can I cancel my order?>>
    <<What are the available sauces?>>
    ```
4. After testing, we improved the prompt with: `Make sure the last question ends with ">>".` and `phrase the questions as if you were the user, not the assistant.`.

<div class="info" data-title="Note">

> The double angle brackets formatting is arbitrary and specific to work with our chat web component. You can choose any other format you want, just make sure to update the parsing logic in the agent-webapp.

</div>

That's it!
You can now test your changes by running the buger MCP server, the agent API and the agent webapp again.

In the agent webapp you should now see the follow-up questions after you get an answer:

![Screenshot of the follow-up questions](./assets/follow-up-questions.png)

You can now redeploy your improved agent by running `azd deploy agent-api` and test it in production.

<!-- TODO:

### Implementing chat history

The current version of the chat API is using the `chat` endpoint to send the messages and get the response once the model has finished generating it. This creates longer wait times for the user, which is not ideal.

OpenAI API have an option to stream the response message, allowing to see the response as soon as it's generated. 
While it doesn't make the model generate the response faster, it allows you to display the response to the user faster so they can start reading it directly while it's being generated. -->
