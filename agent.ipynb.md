## Demo agent for Burger MCP

This simple agent uses [GenAIScript](https://microsoft.github.io/genaiscript/) to demonstrate how to interact with the Burger MCP server. You can try changing the prompts and see how the agent behaves.

### Starting the MCP server
Before running the agent, you first need to run the Burger MCP server on your machine. You can do this by running the following command in the root of the repository:

```sh
npm start
```

This command will start all services required, including the Burger API, dashboard, and other components.

> **NOTE:** You can run this command without the need to deploy anything, as all services can running locally if no cloud resources are found.

### Running the agent
To run the agent, you need to have the [GenAIScript extension](https://marketplace.visualstudio.com/items?itemName=genaiscript.genaiscript-vscode) installed in your VS Code, and an LLM configured.

#### Configuring the LLM model
By default, it uses GitHub models, but you can change it to use any other model by modifying the `model` property in the script. See the [GenAIScript documentation](https://microsoft.github.io/genaiscript/configuration/#model-selection) for more details on how to configure the model.

To allow using GitHub models, you need to set the `GITHUB_TOKEN` environment variable with a valid GitHub token that has access to the models. For this, you need to [create a GitHub personal access token](https://github.com/settings/personal-access-tokens/new?name=GitHub+Models+token&description=Used%20to%20call%20GitHub%20Models%20APIs%20to%20easily%20run%20LLMs%3A%20https%3A%2F%2Fdocs.github.com%2Fgithub-models%2Fquickstart%23step-2-make-an-api-call&user_models=read), with the `models:read` permissions.

If you already deployed the application to Azure, GenAIScript will automatically use the deployed LLM model as set in the root `.env` file.

#### Running the script
Once you're set, simply select the ▶️ (**Execute Cell**) button in the top left of the code cell below.

You can edit the question to try different requests to the MCP server.
```js
script({
  // Wraps MCP servers with their own agent and system prompt
  mcpAgentServers: {
    burgerMcp: {
      description: 'Manages burger orders and menu',
      instructions: 'You\'re an assistant that helps users with managing burger orders and menu information. Use ONLY provided tools to get information and perform actions on behalf of the user. If you can\'t do the specified task, say that you can\'t do it.',
      url: 'http://localhost:3000/mcp',
    }
  },
  // Uncomment the following line to use a specific model, default is 'github:gpt-4.1-mini' (uses GitHub models)
  // model: 'github:gpt-5-mini',
});

// Example prompt, you can change it to test different scenarios
$`Can you suggest a vegan burger with extra mushrooms and no cheese?`;
```

<!-- genaiscript output start -->

<details>
<summary>👤 user</summary>

```md
Can you suggest a vegan burger with extra mushrooms and no cheese?
```

</details>

<details open>
<summary>🤖 assistant </summary>

<details>
<summary>📠 tool call <code>agent_burgerMcp</code> (<code>call_B27g8HvC5VmXJ92yP323MI45</code>)</summary>

```yaml
query: Suggest a vegan burger with extra mushrooms and no cheese.
```

</details>

</details>

<details>
<summary>🛠️ tool output <code>call_B27g8HvC5VmXJ92yP323MI45</code></summary>

```json
Plan: find a vegan burger on the menu, confirm toppings, add mushrooms, ensure no cheese.

Suggestion:
- Spiced Chickpea Vegan Burger (id: 7) — crispy spiced chickpea patty with vegan tzatziki, arugula, tomato, pickled cucumbers, red onion. (Vegan)
- Customization: add extra Grilled Mushrooms (topping id: 5); no cheese (this burger has no cheese by default).
- Price estimate: $10.99 (burger) + $0.80 (extra mushrooms) = $11.79.

If you want me to place the order, provide <MISSING_INFO>: userId and quantity.
```

</details>

<details open>
<summary>🤖 assistant </summary>

```md
Recommended: Spiced Chickpea Vegan Burger (Vegan)

- Description: Crispy spiced chickpea patty with vegan tzatziki, arugula, tomato, pickled cucumbers, red onion.  
- Customization: add extra Grilled Mushrooms (topping id: 5); no cheese (burger is already vegan/no cheese).  
- Price estimate: $10.99 (burger) + $0.80 (extra mushrooms) = $11.79.
```

</details>

<!-- genaiscript output end -->





