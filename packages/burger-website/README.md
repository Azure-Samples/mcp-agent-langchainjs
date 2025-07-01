<div align="center">

# Azure Static Web Apps Burger Orders Website

[![Open project in GitHub Codespaces](https://img.shields.io/badge/Codespaces-Open-blue?style=flat-square&logo=github)](https://codespaces.new/Microsoft/open-hack-build-25?hide_repo_select=true&ref=main&quickstart=true)
![Node version](https://img.shields.io/badge/Node.js->=20-3c873a?style=flat-square)

[Overview](#overview) • [Development](#development)

</div>

## Overview

This website provides a dashboard visualisation interface for the live orders made through the Burger API. This application is built using [Azure Static Web Apps](https://learn.microsoft.com/azure/static-web-apps/) and uses the Azure Functions Burger API to acess the data.

## Development

### Setup development environment

You can run this project directly in your browser by using GitHub Codespaces, which will open a web-based VS Code.

1. [**Fork**](https://github.com/Microsoft/open-hack-build-25/fork) the project to create your own copy of this repository.
2. On your forked repository, select the **Code** button, then the **Codespaces** tab, and click on the button **Create codespace on main**.
   ![Screenshot showing how to create a new codespace](../../docs/images/codespaces.png?raw=true)
3. Wait for the Codespace to be created, it should take a few minutes.

If you prefer to run the project locally, follow [these instructions](../../README.md#use-your-local-environment).

### Run the application

You can run the following command to run the application locally:

```bash
npm start
```

This command will start the [Vite](https://vitejs.dev/) development server and the Azure Functions emulator with the Burger API. This will allow you to test the website locally, using the URL `http://localhost:5173`.
