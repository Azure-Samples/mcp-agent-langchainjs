TODO: WIP

<div class="info" data-title="skip notice">

> This step is entirely optional, you can skip it if you want to jump directly to the next section.

</div>

## Configuring a CI/CD pipeline

We now have a working deployed application, but deploying it manually every time we make a change is not very convenient. We'll automate this process by creating a CI/CD pipeline, using [GitHub Actions](https://github.com/features/actions).

### What's CI/CD?

CI/CD stands for *Continuous Integration and Continuous Deployment*.

Continuous Integration is a software development practice that requires developers to integrate their code into a shared repository several times a day. Each integration can then be verified by an automated build and automated tests. By doing so, you can detect errors quickly, and locate them more easily.

Continuous Deployment pushes this practice further, by preparing for a release to production after each successful build. By doing so, you can get working software into the hands of users faster.

### What's GitHub Actions?

GitHub Actions is a service that lets you automate your software development workflows. A workflow is a series of steps executed one after the other. You can use workflows to build, test and deploy your code, but you can also use them to automate other tasks, like sending a notification when an issue is created.

It's a great way to automate your CI/CD pipelines, and it's free for public repositories.

### Adding the deployment workflow

First we need to create the GitHub Actions workflow. Create the file `.github/workflows/deploy.yml` in your repository, with this content:

```yaml
name: Deploy to Azure
on:
  push:
    # Run when commits are pushed to mainline branch (main)
    # Set this to the mainline branch you are using
    branches: [main]

# Set up permissions for deploying with secretless Azure federated credentials
# https://learn.microsoft.com/azure/developer/github/connect-from-azure?tabs=azure-portal%2Clinux#set-up-azure-login-with-openid-connect-authentication
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      AZURE_CLIENT_ID: ${{ vars.AZURE_CLIENT_ID }}
      AZURE_TENANT_ID: ${{ vars.AZURE_TENANT_ID }}
      AZURE_SUBSCRIPTION_ID: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      AZURE_OPENAI_URL: ${{ vars.AZURE_OPENAI_URL }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install azd
        uses: Azure/setup-azd@v2

      - name: Log in with Azure (Federated Credentials)
        if: ${{ env.AZURE_CLIENT_ID != '' }}
        run: |
          azd auth login `
            --client-id "$Env:AZURE_CLIENT_ID" `
            --federated-credential-provider "github" `
            --tenant-id "$Env:AZURE_TENANT_ID"
        shell: pwsh

      - name: Build and deploy application
        run: azd up --no-prompt
        env:
          AZURE_ENV_NAME: ${{ vars.AZURE_ENV_NAME }}
          AZURE_LOCATION: ${{ vars.AZURE_LOCATION }}
          AZURE_SUBSCRIPTION_ID: ${{ vars.AZURE_SUBSCRIPTION_ID }}
```

This workflow will run when you push a commit change to the `main` branch of your repository. What it does is log in to Azure using the `azd auth login` command, and then run the `azd up` command to provision the infrastructure, build and deploy the application.

Next we need to configure your GitHub repository environment variables. These will be used by the workflow to authenticate to Azure. To do so, run this command:

```bash
azd pipeline config
```

You'll first be asked to log in to GitHub and then it will do the setup for you. These are the steps it will perform:
- Creation of an [Azure Service Principal](https://learn.microsoft.com/entra/identity-platform/app-objects-and-service-principals?tabs=browser) to authenticate to Azure.
- Set up OpenID Connect authentication between GitHub and Azure using [federated credentials](https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-azure).
- Addition of [GitHub variables](https://docs.github.com/actions/learn-github-actions/variables) to your repository to store the IDs needed to authenticate to Azure.

<div data-visible="$$proxy$$">

Since you're using the provided Open AI proxy service we have deployed, there's one extra variable that you need to set.

First we need to log in to GitHub using the [GitHub CLI](https://cli.github.com/):

```bash
# We need more permissions than provided by default with Codespaces
unset GITHUB_TOKEN
gh auth login -w
```

Once you're logged in, run this command to set the value of the `AZURE_OPENAI_URL` variable in your repository:

```bash
gh variable set AZURE_OPENAI_URL \
  --body "$$proxy$$" \
  --repo <your_github_username>/<your_forked_repository>
```

</div>

### Testing the deployment workflow

Now that we have our workflow fully configured, we can test it by pushing a change to our repository. Commit your changes and push them to GitHub:

```bash
git add .
git commit -m "Setup CI/CD"
git push
```

The workflow will run automatically, so we can look at its progress directly on GitHub. Open your repository in a browser, and select the **Actions** tab. You should see the workflow running. It will take a few minutes to complete, but you can follow the progress in the logs by clicking on the running workflow.

![Screenshot showing GitHub Actions workflow running](./assets/gh-actions.png)

Then select the job named **deploy** on the left, and you should see the logs of the workflow.

![Screenshot showing GitHub Actions workflow logs](./assets/gh-workflow-details.png)

When the workflow is complete, you should see a green checkmark.
