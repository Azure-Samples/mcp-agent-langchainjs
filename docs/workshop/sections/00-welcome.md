---
short_title: AI Agent with LangChain.js
description: Discover how to create an AI agent using LangChain.js and MCP to interact with a burger restaurant API, build a web interface, and deploy it on Azure.
type: workshop
authors:
- Yohan Lasorsa
contacts:
- '@sinedied'
banner_url: assets/banner.jpg
duration_minutes: 120
audience: students, devs
level: intermediate
tags: openai, langchain, agent, mcp, azure, serverless, static web apps, javascript, typescript, node.js, langchain.js
published: false
wt_id: javascript-0000-cxa
sections_title:
  - Welcome
---

# Create your AI Agent with MCP and LangChain.js

In this workshop, we'll explore how to build an AI agent that can interact with a burger restaurant API using LangChain.js and the Model Context Protocol (MCP). Your agent will be able to answer questions about the menu, provide recommendations, and place orders, all through a web interface.

We'll cover how to set up an MCP server and connect it to an existing REST API handling menu and orders data, allowing your LangChain.js agent to fetch real-time information and perform actions on behalf of users. 

## You'll learn how to...

- Build an AI agent using [LangChain.js](https://docs.langchain.com/oss/javascript/langchain/overview).
- Create an MCP (Model Context Protocol) server with [Express](https://expressjs.com) to allow the AI agent to connect with a REST API.
- Use **context engineering** to improve the performance of your AI agent.
- Use [OpenAI](https://openai.com) models and [LangChain.js](https://js.langchain.com/docs/) to generate answers based on a prompt.
- Create a serverless Web API with [Azure Functions](https://learn.microsoft.com/azure/azure-functions/).
- Connect your agent API to a chat website.
- Deploy the API, MCP server and web app as serverless applications on Azure.

## Prerequisites

<div data-hidden="$$proxy$$">

| | |
|----------------------|------------------------------------------------------|
| GitHub account       | [Get a free GitHub account](https://github.com/join) |
| Azure account        | [Get a free Azure account](https://azure.microsoft.com/free) |
| A Web browser        | [Get Microsoft Edge](https://www.microsoft.com/edge) |
| JavaScript knowledge | [JavaScript tutorial on MDN documentation](https://developer.mozilla.org/docs/Web/JavaScript)<br>[JavaScript for Beginners on YouTube](https://www.youtube.com/playlist?list=PLlrxD0HtieHhW0NCG7M536uHGOtJ95Ut2) |
| Basic LLM knowledge | [Introduction to Large Language Models](https://www.youtube.com/watch?v=GQ_2OjNZ9aA&list=PLlrxD0HtieHi5ZpsHULPLxm839IrhmeDk&index=2) |

</div>

<div data-visible="$$proxy$$">

| | |
|--------------------------|------------------------------------------------------|
| GitHub account           | [Get a free GitHub account](https://github.com/join) |
| Azure account (optional) | [Get a free Azure account](https://azure.microsoft.com/free) |
| A Web browser            | [Get Microsoft Edge](https://www.microsoft.com/edge) |
| JavaScript knowledge     | [JavaScript tutorial on MDN documentation](https://developer.mozilla.org/docs/Web/JavaScript)<br>[JavaScript for Beginners on YouTube](https://www.youtube.com/playlist?list=PLlrxD0HtieHhW0NCG7M536uHGOtJ95Ut2) |
| Basic LLM knowledge      | [Introduction to Large Language Models](https://www.youtube.com/watch?v=GQ_2OjNZ9aA&list=PLlrxD0HtieHi5ZpsHULPLxm839IrhmeDk&index=2) |

</div>

We'll use [GitHub Codespaces](https://github.com/features/codespaces) to have an instant dev environment already prepared for this workshop.

If you prefer to work locally, we'll also provide instructions to setup a local dev environment using either VS Code with a [dev container](https://aka.ms/vscode/ext/devcontainer) or a manual install of the needed tools.

<div class="info" data-title="note">

> Your Azure account must have `Microsoft.Authorization/roleAssignments/write` permissions, such as [Role Based Access Control Administrator](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#role-based-access-control-administrator-preview), [User Access Administrator](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#user-access-administrator), or [Owner](https://learn.microsoft.com/azure/role-based-access-control/built-in-roles#owner). Your account also needs `Microsoft.Resources/deployments/write` permissions at a subscription level to allow deployment of Azure resources.
>
> If you have your own personal Azure subscription, you should be good to go. **If you're using an Azure subscription provided by your company, you may need to contact your IT department to ensure you have the necessary permissions**.

</div>
