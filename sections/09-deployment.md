## Deploying to Azure

Our application is now ready to be deployed to Azure!

We'll use [Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/overview) to deploy the frontend, and [Azure Functions](https://learn.microsoft.com/azure/azure-functions/functions-overview) to deploy the different backend services (Agent API, Burger API and Burger MCP).

Run this command from the root of the project to build and deploy the application (this command deploys all services listed in the `azure.yaml` file located in the project root):

```bash
azd deploy
```

Once it's done, you should see the URL of the deployed frontend application in the output of the command.

![Output of the azd command](./assets/azd-deploy-output.png)

You can now open the agent webapp URL in a browser and test the deployed application.

<div class="important" data-title="Important" data-visible="$$burger_api$$">

You have to open the `<agent-webapp-url>/register` URL first to register your user ID before using the agent, since you're now using your Burger API with its own user database.

</div>

<div class="tip" data-title="Tip">

> You can also build and deploy the services separately by running `azd deploy <service_name>`.
>
> Even better! If you're starting from scratch and have a completed code, you can use the `azd up` command. This command combines both `azd provision` and `azd deploy` to provision the Azure resources and deploy the application in one command.

</div>
