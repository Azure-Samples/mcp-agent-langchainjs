TODO: WIP, add Azure Flex Functions + BYO MCP

## Azure setup

[Azure](https://azure.microsoft.com) is Microsoft's comprehensive cloud platform, offering a vast array of services to build, deploy, and manage applications across a global network of Microsoft-managed data centers. In this workshop, we'll leverage several Azure services to run our chat application.

### Getting Started with Azure

To complete this workshop, you'll need an Azure account. If you don't already have one, you can sign up for a free account, which includes Azure credits, on the [Azure website](https://azure.microsoft.com/free/).

<div class="important" data-title="important">

> If you already have an Azure account from your company, make sure to check with your administrator that you have sufficient permissions to create resources and assign system roles (more details in the [prerequisites](?step=0#prerequisites) section).

</div>

### Configure your project and deploy infrastructure

Before we dive into the details, let's set up the Azure resources needed for this workshop. This initial setup may take a few minutes, so it's best to start now. We'll be using the [Azure Developer CLI](https://learn.microsoft.com/azure/developer/azure-developer-cli/), a tool designed to streamline the creation and management of Azure resources.

#### Log in to Azure

Begin by logging into your Azure subscription with the following command:

```sh
azd auth login --use-device-code
```

This command will provide you a *device code* to enter in a browser window. Follow the prompts until you're notified of a successful login.

#### Create a New Environment

Next, set up a new environment. The Azure Developer CLI uses environments to manage settings and resources:

```sh
azd env new mcp-agent-workshop
```

<div data-visible="$$proxy$$">

As we have deployed an OpenAI service for you, run this command to set the OpenAI URL we want to use:

```sh
azd env set AZURE_OPENAI_URL $$proxy$$
```

</div>

<div class="important" data-title="Important">

> If you're using an Azure for Students or Free Trial account that you just created, you need to run the following command:
> ```sh
> azd env set USE_AZURE_FREE true
> ```

</div>

#### Deploy Azure Infrastructure

Now it's time to deploy the Azure infrastructure for the workshop. Execute the following command:

```sh
azd provision
```

You will be prompted to select an Azure subscription and a deployment region. It's generally best to choose a region closest to your user base for optimal performance, but for this workshop, choose `North Europe` or `East US 2` depending of which one is the closest to you.

<div class="info" data-title="Note">

> Some Azure services, such as Azure OpenAI, have [limited regional availability](https://azure.microsoft.com/explore/global-infrastructure/products-by-region/?products=cognitive-services,search&regions=non-regional,europe-north,europe-west,france-central,france-south,us-central,us-east,us-east-2,us-north-central,us-south-central,us-west-central,us-west,us-west-2,us-west-3,asia-pacific-east,asia-pacific-southeast). If you're unsure which region to select, _East US 2_ and _North Europe_ are typically safe choices as they support a wide range of services.

</div>

After your infrastructure is deployed, run this command:

```bash
azd env get-values > .env
```

This will create a `.env` file at the root of your repository, containing the environment variables needed to connect to your Azure services.

As this file may sometimes contains application secrets, it's a best practice to keep it safe and not commit it to your repository. We already added it to the `.gitignore` file, so you don't have to worry about it.

At this stage, if you go to the Azure Portal at [portal.azure.com](https://portal.azure.com) you should see something similar to this:

![Resource deployed on Azure](./assets/azure-portal-azd.png)

### Deploying the ingestion service

Once your infrastructure is deployed, you can immediately deploy the ingestion service so we can some gain time later. We'll explore the ingestion service in more detail later in the workshop.

```sh
azd deploy ingestion
```

### Introducing Azure services

In our journey to deploy the chat application, we'll be utilizing a suite of Azure services, each playing a crucial role in the application's architecture and performance.

![Application architecture](./assets/azure-architecture.png)

Here's a brief overview of the Azure services we'll use:

| Service | Purpose |
| ------- | ------- |
| [Azure Container Apps](https://learn.microsoft.com/azure/container-apps/) | Hosts our containerized applications with features like auto-scaling and load balancing. |
| [Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/) | Serves our static Web chat with integrated APIs, authentication, and global distribution. |
| [Azure Container Registry](https://learn.microsoft.com/azure/container-registry/) | Stores our Docker container images in a managed, private registry. |
| [Azure Log Analytics](https://learn.microsoft.com/azure/log-analytics/) | Collects and analyzes telemetry and logs for insights into application performance and diagnostics. |
| [Azure Monitor](https://learn.microsoft.com/azure/azure-monitor/) | Provides comprehensive monitoring of our applications, infrastructure, and network. |

While Azure Log Analytics and Azure Monitor aren't depicted in the initial diagram, they're integral to our application's observability, allowing us to troubleshoot and ensure our application is running optimally.

#### About Azure Container Apps

[Azure Container Apps](https://learn.microsoft.com/azure/container-apps/overview) is our primary service for running the chat application. It's a serverless container service that abstracts away the underlying infrastructure, enabling us to focus on writing and deploying code.

Key features of Azure Container Apps include:

- **Serverless Nature**: Automatically scales up or down, even to zero, to match demand.
- **Simplified Management**: No need to manage Kubernetes clusters or nodes.
- **Integrated Environment**: Built-in support for Dapr and KEDA, facilitating microservices development and event-driven scaling.
- **Traffic Splitting**: Facilitates A/B testing and phased rollouts with traffic routing between different app revisions.

![Azure compute options spectrum](./assets/azure-compute-services.png)

Azure Container Apps sits in the sweet spot between PaaS and FaaS, offering the flexibility of a PaaS with the scaling characteristics of a FaaS.

Container Apps is built on top of [Azure Kubernetes Service](https://learn.microsoft.com/azure/aks/), including a deep integration with KEDA (event-driven auto scaling for Kubernetes), Dapr (distributed application runtime) and Envoy (a service proxy designed for cloud-native applications).
The underlying complexity is completely abstracted for you.
So, no need to configure your Kubernetes service, ingress, deployment, volume manifests... You get a very simple API and user interface to configure the desired configuration for your containerized application.
This simplification means also less control, hence the difference with AKS.

![Diagram showing the architecture of Azure Container Apps](./assets/azure-container-apps.png)

Azure Container Apps introduces the following concepts:
- *Environment*: this is a secure boundary around a group of Container Apps.
They are deployed in the same virtual network, these apps can easily intercommunicate easily with each other and they write logs to the same Log Analytics workspace. An environment can be compared with a Kubernetes namespace.

- *Container App*: this is a group of containers (pod) that is deployed and scale together. They share the same disk space and network.

- *Revision*: this is an immutable snapshot of a Container App.
New revisions are automatically created and are valuable for HTTP traffic redirection strategies, such as A/B testing.

### Creating the infrastructure

Now that we know what we'll be using, let's create the infrastructure we'll need for this workshop.

To set up our application, we can choose from various tools like the Azure CLI, Azure Portal, ARM templates, or even third-party tools like Terraform. All these tools interact with Azure's backbone, the [Azure Resource Manager (ARM) API](https://docs.microsoft.com/azure/azure-resource-manager/management/overview).

![Azure Resource Manager interaction diagram](./assets/azure-resource-manager.png)

Any resource you create in Azure is part of a **resource group**. A resource group is a logical container that holds related resources for an Azure solution, just like a folder.

When we ran `azd provision`, it created a resource group named `rg-mcp-agent-workshop` and deployed all necessary infrastructure components using Infrastructure as Code (IaC) templates.

### Introducing Infrastructure as Code

Infrastructure as Code (IaC) is a practice that enables the management of infrastructure using configuration files. It ensures that our infrastructure deployment is repeatable and consistent, much like our application code. This code is committed to your project repository so you can use it to create, update, and delete your infrastructure as part of your CI/CD pipeline or locally.

There are many existing tools to manage your infrastructure as code, such as Terraform, Pulumi, or [Azure Resource Manager (ARM) templates](https://learn.microsoft.com/azure/azure-resource-manager/templates/overview). ARM templates are JSON files that allows you to define and configure Azure resources.

For this workshop, we're using [Bicep](https://learn.microsoft.com/azure/azure-resource-manager/bicep/overview?tabs=bicep), a language that simplifies the authoring of ARM templates.

#### What's Bicep?

Bicep is a Domain Specific Language (DSL) for deploying Azure resources declaratively. It's designed for clarity and simplicity, with a focus on ease of use and code reusability. It's a transparent abstraction over ARM templates, which means anything that can be done in an ARM Template can be done in Bicep.

Here's an example of a Bicep file that creates a Log Analytics workspace:

```bicep
resource logsWorkspace 'Microsoft.OperationalInsights/workspaces@2021-06-01' = {
  name: 'my-awesome-logs'
  location: 'westeurope'
  tags: {
    environment: 'production'
  }
  properties: {
    retentionInDays: 30
  }
}
```

A resource is made of differents parts. First, you have the `resource` keyword, followed by a symbolic name of the resource that you can use to reference that resource in other parts of the template. Next to it is a string with the resource type you want to create and API version.

<div class="info" data-title="note">

> The API version is important, as it defines the version of the template used for a resource type. Different API versions can have different properties or options, and may introduce breaking changes. By specifying the API version, you ensure that your template will work regardless of the product updates, making your infrastructure more resilient over time.

</div>

Inside the resource, you then specify the name of the resource, its location, and its properties. You can also add tags to your resources, which are key/value pairs that you can use to categorize and filter your resources.

Bicep templates can be modular, allowing for the reuse of code across different parts of your infrastructure. They can also accept parameters, making your infrastructure dynamically adaptable to different environments or conditions.

Explore the `./infra` directory to see how the Bicep files are structured for this workshop. The `main.bicep` file is the entry point, orchestrating various modules found in the `./infra/core` folder.

Bicep streamlines the template creation process, and you can get started with existing templates from the [Azure Quickstart Templates](https://github.com/Azure/azure-quickstart-templates/tree/master/quickstarts), use the [Bicep VS Code extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-bicep) for assistance, or try out the [Bicep playground](https://aka.ms/bicepdemo) for converting between ARM and Bicep formats.
