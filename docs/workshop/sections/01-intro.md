## Introduction

When it was introduced, generative AI was mostly limited to answering questions, and could not take actions. This left users to manually perform tasks based on the AI's suggestions. With the advent of AI agents and standard protocols like MCP (Model Context Protocol), we can now build AI systems that can autonomously interact with APIs and services to perform tasks of varying complexity, moving beyond simple Q&A.

When integrated in existing systems, like in this case a burger ordering service, AI agents can improve the user experience by streamlining interactions and providing personalized assistance. They can understand user preferences, make recommendations, and even place orders. Imagine an assistant available 24/7, capable of handling multiple requests simultaneously, all while providing a personalized experience. This is what AI agents bring to the table.

<div class="info" data-title="note">

> **Accuracy in Generative AI** 
> Large Language Models (LLMs), like the ones powering ChatGPT, do not have by design direct access to the external world. They may produce "hallucinations", offering responses that seem authoritative but are factually incorrect. It's crucial to **inform users that the responses are AI-generated**. During this workshop, we'll explore how to provide LLMs a limited access to external information sources and possible actions, allowing them to *ground* their answers and reduce hallucinations.

</div>

In this workshop, we'll guide you through building an AI agent that can assist users with several tasks, through the usage of a business API. We'll touch on many different topics, but we'll take it one step at a time.

### Application architecture

Below is the architecture of the application we're going to build:

![Application architecture](./assets/simplified-architecture.drawio.png)

Our application consists of five main components:

1. **Burger API**: This is the existing business API that provides information about the menu and orders. In a real-world scenario, this could be any API relevant to your business domain.

2. **Burger MCP server**: This server exposes the burger API as a Model Context Protocol (MCP) service.

3. **Agent API**: This API hosts the LangChain.js AI agent, which processes user requests and interacts with the burger API through the MCP server.

4. **Agent Web App**: This site offers a chat interface for users to send requests to the Agent API and view the generated responses.

5. **Microsoft Foundry model**: We will use the `gpt-5-mini` model, hosted on Azure, for this workshop. The code can also be adapted to work with OpenAI's APIs or Ollama with minimal changes.

### What's an AI Agent?

An AI agent is an autonomous software system that can perceive its environment, make decisions, and take actions to achieve specific goals. Unlike traditional chatbots that only respond to questions, AI agents can:

- **Understand context and intent** from user requests
- **Plan and execute multi-step tasks** by breaking down complex problems
- **Interact with external systems** like APIs, databases, and services
- **Learn and adapt** from previous interactions to improve performance
- **Make decisions autonomously** based on available information and defined objectives

In essence, AI agents bridge the gap between **conversation** and **action**, enabling AI systems to not just talk about tasks, but actually perform them.

There is two key concepts to understand when working with AI agents: **tools** and **workflows**.

1. **Tools**: Tools are external functions or APIs that the agent can use to perform specific actions. In our case, the burger API is exposed through the multiple MCP tools that the agent can call to retrieve menu information or act on orders.

2. **Workflows**: Workflows define the sequence of steps the agent takes to accomplish a task. This includes deciding which tools to use, in what order, and how to process the information received from those tools to generate a final response.

For common use cases like our burger ordering assistant, AI agents can follow this workflow that works as a decision loop:

![Simple agent loop workflow](./assets/agent-loop.png)

The flow goes like this:
1. The user send in a query, like “order a vegan burger”.
2. The LLM decides which tool to call.
3. Based on the feedback from the tool calling, it decides the next action: call another tool, or return the final answer.

### What's MCP (Model Context Protocol)?

The Model Context Protocol (MCP) is a standardized way for AI models to interact with external tools and data. It defines how models can request information, perform actions, and receive responses in a structured manner. It’s an open-source protocol that has seen fast adoption in the AI community, enabling interoperability between different AI systems and tool providers. MCP has [joined the Linux Foundation](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation) to further its development and adoption.

One of its main usages is to act as "the glue" that allows to connect tool providers with any AI agent. By implementing an MCP server, tool providers can expose their APIs in a way that AI agents can easily discover and use them, without needing custom integration for each agent, model or framework.

![Example MCP integration](./assets/mcp-schema.drawio.png)

MCP requires two main components to work together:

1. **MCP Server**: This server exposes the tools in a standardized format, describing the usage and parameters of each tool.
2. **MCP Client**: This client is integrated into the AI agent, allowing it to discover and call the tools exposed by the MCP server.

An offical MCP SDK is available for many languages, including TypeScript. In this workshop, we will use the TypeScript MCP SDK to create an MCP server that exposes the burger API as a set of MCP tools, and use the MCP client with LangChain.js to allow our AI agent to interact with those tools.

<div class="info" data-title="note">

> While the main usage of MCP is to provide tools, it supports [other features](https://modelcontextprotocol.io/specification/latest) as well, both from the server and client side, like exposing data resources and prompts to the agents. In this workshop, we will focus exclusively on the tool aspect of MCP.

</div>
