## Complete the setup

To complete the template setup, please run the following command in a terminal, at the root of the project:

```bash
./docs/workshop/setup-template.sh
```

### Preparing the environment

After the template setup is complete, we'll prepare a `.env` file with the necessary environment variables to run the project.

<div data-visible="$$proxy$$">

We have deployed an OpenAI proxy service for you, so you can use it to work on this workshop locally before deploying anything to Azure.

Create a `.env` file at the root of the project, and add the following content:

<div data-visible="$$burger_api$$">

```
AZURE_OPENAI_API_ENDPOINT=$$proxy$$
BURGER_API=$$burger_api$$
```

</div>
<div data-hidden="$$burger_api$$">

```
AZURE_OPENAI_API_ENDPOINT=$$proxy$$
```

</div>

</div>

<div data-hidden="$$proxy$$">

Now you either have to deploy an Azure OpenAI service to use the OpenAI API, or you can use a local emulator based on Ollama and an open-source LLM.

#### Using Azure OpenAI

You first need to deploy an Azure OpenAI service to use the OpenAI API.

Before moving to the next section, go to the **Azure setup** section (either on the left or using the "hamburger" menu depending of your device) to deploy the necessary resources and create your `.env` file needed.

After you completed the Azure setup, come back here to continue the workshop.

At this point you should have a `.env` file at the root of the project that contains the required environment variables to connect to your Azure resources.

#### (Optional) Using Ollama

If you have a machine with enough resources, you can run this workshop entirely locally without using any cloud resources. To do that, you first have to install [Ollama](https://ollama.com) and then run the following commands to download the models on your machine:

```bash
ollama pull ministral-3
```

<div class="info" data-title="Note">

> The `ministral-3` model with download a few gigabytes of data, so it can take some time depending on your internet connection.

</div>

<div class="important" data-title="Important">

> Ollama work in GitHub Codespaces, but runs **very slow** currently. If you want to use the Ollama option, it will work best if you are working on the workshop on your local machine directly.

</div>

Once the model are downloaded, create a `.env` file at the root of the project, and add the following content:

<div data-visible="$$burger_api$$">

```
AZURE_OPENAI_API_ENDPOINT=http://localhost:11434
BURGER_API=$$burger_api$$
```

</div>
<div data-hidden="$$burger_api$$">

```
AZURE_OPENAI_API_ENDPOINT=http://localhost:11434
```

</div>

</div>

### Getting your personal user ID

To interact with the Burger API, you will need a personal user ID.

<div data-visible="$$burger_api$$">

Open $$register_url$$ in a browser and login with a GitHub or Microsoft account to register and get your unique user ID.

</div>
<div data-hidden="$$burger_api$$">

To get your personal user ID, we'll start a local registration service that will create the user ID.

Run the following command in a new terminal, at the root of the project:

```bash
npm run start:agent
```

Then open `http://localhost:4280/register.html` in a browser to register and get your unique user ID.

When trying to log in, you'll be prompted by the Azure Static Web Apps authentication emulator. Enter a username and select **Login** to proceed.

</div>

You should then see your unique user ID displayed on the page:

![Contoso Burgers membership card showing user ID](./assets/user-id.png)

Copy your user ID and add it to your `.env` file as follows:

```
USER_ID=your-unique-user-id
```

This ID will allow you to place orders and interact with the burger orders on the API throughout the workshop.
