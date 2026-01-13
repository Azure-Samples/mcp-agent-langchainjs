## Conclusion

This is the end of the workshop. We hope you enjoyed it, learned something new and more importantly, that you'll be able to take this knowledge back to your projects.

If you missed any of the steps or would like to check your final code, you can run this command in the terminal **at the root of the project** to get the completed solution (be sure to commit your code first!):

```bash
curl -fsSL https://github.com/Azure-Samples/mcp-agent-langchainjs/releases/download/latest/solution.tar.gz | tar -xvz
```

<div class="warning" data-title="had issues?">

> If you experienced any issues during the workshop, please let us know by [creating an issue](https://github.com/Azure-Samples/mcp-agent-langchainjs/issues) on the GitHub repository.

</div>

### Cleaning up Azure resources

<div class="important" data-title="important">

> Don't forget to delete the Azure resources once you are done running the workshop, to avoid incurring unnecessary costs!

</div>

To delete the Azure resources, you can run this command:

```bash
azd down --purge
```

### Going further

This workshop is based on the enterprise-ready sample **AI Agent with MCP tools using LangChain.js**, available in the same repository as the one you used for the workshop: https://github.com/Azure-Samples/mcp-agent-langchainjs

You'll notice a few differences between the workshop code and the sample code, as the sample code includes more advanced features such as authentication, conversation history, Agent CLI, data generation and more.

If you want to go further with more advanced use-cases, authentication, history and more, you should check it out!

### References

- This workshop URL: [aka.ms/ws/mcp-agent](https://aka.ms/ws/mcp-agent)
- The source repository for this workshop: [GitHub link](https://github.com/Azure-Samples/mcp-agent-langchainjs)
- If something does not work: [Report an issue](https://github.com/Azure-Samples/mcp-agent-langchainjs/issues)
- Introduction presentation for this workshop: [Slides](https://azure-samples.github.io/mcp-agent-langchainjs/)
