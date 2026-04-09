## Task

1. Run `azd env set ENABLE_BEERS true` from the root of the project in a terminal. If no environment has been set up yet, you can run `azd env new` first to create a new environment, then run the command to set the variable.
2. Enable the Beer MCP service by uncommenting `beer-mcp` in `azure.yaml`
3. Rename `_start:beer` to `start:beer` in root `package.json`

Once you have done the above steps, just prompt the user to run the `azd up` command to deploy the infrastructure and services to complete the setup.
