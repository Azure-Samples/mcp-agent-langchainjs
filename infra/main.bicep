targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the the environment which is used to generate a short unique hash used in all resources.')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
// Flex Consumption functions are only supported in these regions.
// Run `az functionapp list-flexconsumption-locations --output table` to get the latest list
@allowed([
  'northeurope'
  'southeastasia'
  'eastasia'
  'eastus2'
  'southcentralus'
  'australiaeast'
  'eastus'
  'westus2'
  'uksouth'
  'eastus2euap'
  'westus3'
  'swedencentral'
])
param location string

param resourceGroupName string = ''
param pizzaApiServiceName string = 'pizza-api'
param pizzaMcpServiceName string = 'pizza-mcp'
param pizzaWebappName string = 'pizza-website'
param registrationApiServiceName string = 'registration-api'
param registrationWebappName string = 'registration-website'
param blobContainerName string = 'blobs'

@description('Location for the OpenAI resource group')
@allowed([
  'australiaeast'
  'canadaeast'
  'eastus'
  'eastus2'
  'francecentral'
  'japaneast'
  'northcentralus'
  'swedencentral'
  'switzerlandnorth'
  'uksouth'
  'westeurope'
])
@metadata({
  azd: {
    type: 'location'
  }
})
param aiServicesLocation string // Set in main.parameters.json
param openAiApiVersion string // Set in main.parameters.json
param chatModelName string // Set in main.parameters.json
param chatModelVersion string // Set in main.parameters.json
param chatModelCapacity int // Set in main.parameters.json
param embeddingsModelName string // Set in main.parameters.json
param embeddingsModelVersion string // Set in main.parameters.json
param embeddingsModelCapacity int // Set in main.parameters.json

// Location is not relevant here as it's only for the built-in api
// which is not used here. Static Web App is a global service otherwise
@description('Location for the Static Web App')
@allowed(['westus2', 'centralus', 'eastus2', 'westeurope', 'eastasia', 'eastasiastage'])
@metadata({
  azd: {
    type: 'location'
  }
})
param webappLocation string = 'eastus2'

// Id of the user or app to assign application roles
param principalId string = ''

// Differentiates between automated and manual deployments
param isContinuousIntegration bool // Set in main.parameters.json

param pizzaMcpContainerAppExists bool = false

// ---------------------------------------------------------------------------
// Services configuration

var services = loadJsonContent('services.json')

// Enable Azure OpenAI deployment
var useOpenAi = services.?useOpenAi ?? false

// ---------------------------------------------------------------------------
// Common variables

var abbrs = loadJsonContent('abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }

var principalType = isContinuousIntegration ? 'ServicePrincipal' : 'User'
var pizzaApiResourceName = '${abbrs.webSitesFunctions}pizza-api-${resourceToken}'
var pizzaMcpResourceName = '${abbrs.appContainerApps}pizza-mcp-${resourceToken}'
var registrationApiResourceName = '${abbrs.webSitesFunctions}registration-api-${resourceToken}'
var storageAccountName = '${abbrs.storageStorageAccounts}${resourceToken}'
var openAiUrl = useOpenAi ? 'https://${openAi.outputs.name}.openai.azure.com' : ''
var storageUrl = 'https://${storage.outputs.name}.blob.${environment().suffixes.storage}'
var pizzaApiUrl = 'https://${pizzaApiFunction.outputs.defaultHostname}'
var pizzaMcpUrl = pizzaMcpContainerApp.outputs.uri
var pizzaWebappUrl = 'https://${pizzaWebapp.outputs.defaultHostname}'
var registrationApiUrl = 'https://${registrationApiFunction.outputs.defaultHostname}'
var registrationWebappUrl = 'https://${registrationWebapp.outputs.defaultHostname}'

// ---------------------------------------------------------------------------
// Resources

resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: !empty(resourceGroupName) ? resourceGroupName : '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

module pizzaApiFunction 'br/public:avm/res/web/site:0.13.0' = {
  name: 'pizza-api'
  scope: resourceGroup
  params: {
    tags: union(tags, { 'azd-service-name': pizzaApiServiceName })
    location: location
    kind: 'functionapp,linux'
    name: pizzaApiResourceName
    serverFarmResourceId: pizzaApiAppServicePlan.outputs.resourceId
    appInsightResourceId: monitoring.outputs.applicationInsightsResourceId
    managedIdentities: { systemAssigned: true }
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'FtpsOnly'
      cors: {
        allowedOrigins: [
          '*'
        ]
        supportCredentials: false
      }
    }
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.outputs.primaryBlobEndpoint}${pizzaApiResourceName}'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      scaleAndConcurrency: {
        alwaysReady: [
          {
            name: 'http'
            instanceCount: '1'
          }
        ]
        maximumInstanceCount: 1000
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'node'
        version: '20'
      }
    }
    storageAccountResourceId: storage.outputs.resourceId
    storageAccountUseIdentityAuthentication: true
  }
}

// Needed to avoid circular resource dependencies
module pizzaApiFunctionSettings './core/site-app-settings.bicep' = {
  name: 'pizza-api-settings'
  scope: resourceGroup
  params: {
    appName: pizzaApiFunction.outputs.name
    kind: 'functionapp,linux'
    appSettingsKeyValuePairs: union(
      {
        REGISTRATION_WEBAPP_URL: registrationWebappUrl
        AZURE_STORAGE_URL: storageUrl
        AZURE_STORAGE_CONTAINER_NAME: blobContainerName
        AZURE_COSMOSDB_NOSQL_ENDPOINT: cosmosDb.outputs.endpoint
      },
      useOpenAi
        ? {
            AZURE_OPENAI_ENDPOINT: openAiUrl
            AZURE_OPENAI_CHAT_DEPLOYMENT_NAME: chatModelName
            AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME: embeddingsModelName
            AZURE_OPENAI_INSTANCE_NAME: openAi.outputs.name
            AZURE_OPENAI_API_VERSION: openAiApiVersion
          }
        : {}
    )
    storageAccountResourceId: storage.outputs.resourceId
    storageAccountUseIdentityAuthentication: true
    appInsightResourceId: monitoring.outputs.applicationInsightsResourceId
  }
}

module registrationApiFunction 'br/public:avm/res/web/site:0.13.0' = {
  name: 'registration-api'
  scope: resourceGroup
  params: {
    tags: union(tags, { 'azd-service-name': registrationApiServiceName })
    location: location
    kind: 'functionapp,linux'
    name: registrationApiResourceName
    serverFarmResourceId: registrationApiAppServicePlan.outputs.resourceId
    appInsightResourceId: monitoring.outputs.applicationInsightsResourceId
    managedIdentities: { systemAssigned: true }
    siteConfig: {
      minTlsVersion: '1.2'
      ftpsState: 'FtpsOnly'
      cors: {
        allowedOrigins: [
          '*'
        ]
        supportCredentials: false
      }
    }
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.outputs.primaryBlobEndpoint}${pizzaMcpResourceName}'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      scaleAndConcurrency: {
        alwaysReady: [
          {
            name: 'http'
            instanceCount: '1'
          }
        ]
        maximumInstanceCount: 1000
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'node'
        version: '20'
      }
    }
    storageAccountResourceId: storage.outputs.resourceId
    storageAccountUseIdentityAuthentication: true
  }
}

module pizzaApiAppServicePlan 'br/public:avm/res/web/serverfarm:0.4.1' = {
  name: 'pizza-api-appserviceplan'
  scope: resourceGroup
  params: {
    name: '${abbrs.webServerFarms}pizza-api-${resourceToken}'
    tags: tags
    location: location
    skuName: 'FC1'
    reserved: true
  }
}

module pizzaWebapp 'br/public:avm/res/web/static-site:0.9.0' = {
  name: 'pizza-webapp'
  scope: resourceGroup
  params: {
    name: pizzaWebappName
    location: webappLocation
    tags: union(tags, { 'azd-service-name': pizzaWebappName })
  }
}

module registrationApiAppServicePlan 'br/public:avm/res/web/serverfarm:0.4.1' = {
  name: 'registration-api-appserviceplan'
  scope: resourceGroup
  params: {
    name: '${abbrs.webServerFarms}registration-api-${resourceToken}'
    tags: tags
    location: location
    skuName: 'FC1'
    reserved: true
  }
}

// Needed to avoid circular resource dependencies
module registrationApiFunctionSettings './core/site-app-settings.bicep' = {
  name: 'registration-api-settings'
  scope: resourceGroup
  params: {
    appName: registrationApiFunction.outputs.name
    kind: 'functionapp,linux'
    appSettingsKeyValuePairs: {
      AZURE_COSMOSDB_NOSQL_ENDPOINT: cosmosDb.outputs.endpoint
    }
    storageAccountResourceId: storage.outputs.resourceId
    storageAccountUseIdentityAuthentication: true
    appInsightResourceId: monitoring.outputs.applicationInsightsResourceId
  }
}

module registrationWebapp 'br/public:avm/res/web/static-site:0.9.0' = {
  name: 'registration-webapp'
  scope: resourceGroup
  params: {
    name: registrationWebappName
    location: webappLocation
    tags: union(tags, { 'azd-service-name': registrationWebappName })
    sku: 'Standard'
    linkedBackend: {
      resourceId: registrationApiFunction.outputs.resourceId
      location: location
    }
  }
}

module storage 'br/public:avm/res/storage/storage-account:0.19.0' = {
  name: 'storage'
  scope: resourceGroup
  params: {
    name: storageAccountName
    tags: tags
    location: location
    skuName: 'Standard_LRS'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
    blobServices: {
      containers: [
        {
          name: pizzaApiResourceName
        }
        {
          name: pizzaMcpResourceName
        }
        {
          name: blobContainerName
          publicAccess: 'None'
        }
      ]
    }
    roleAssignments: [
      {
        principalId: principalId
        principalType: principalType
        roleDefinitionIdOrName: 'Storage Blob Data Contributor'
      }
    ]
  }
}

module monitoring 'br/public:avm/ptn/azd/monitoring:0.1.1' = {
  name: 'monitoring'
  scope: resourceGroup
  params: {
    tags: tags
    location: location
    applicationInsightsName: '${abbrs.insightsComponents}${resourceToken}'
    applicationInsightsDashboardName: '${abbrs.portalDashboards}${resourceToken}'
    logAnalyticsName: '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
  }
}

module openAi 'br/public:avm/res/cognitive-services/account:0.10.2' = if (useOpenAi) {
  name: 'openai'
  scope: resourceGroup
  params: {
    name: '${abbrs.cognitiveServicesAccounts}${resourceToken}'
    tags: tags
    location: aiServicesLocation
    kind: 'OpenAI'
    disableLocalAuth: true
    customSubDomainName: '${abbrs.cognitiveServicesAccounts}${resourceToken}'
    publicNetworkAccess: 'Enabled'
    deployments: [
      {
        name: chatModelName
        model: {
          format: 'OpenAI'
          name: chatModelName
          version: chatModelVersion
        }
        sku: {
          capacity: chatModelCapacity
          name: 'GlobalStandard'
        }
      }
      {
        name: embeddingsModelName
        model: {
          format: 'OpenAI'
          name: embeddingsModelName
          version: embeddingsModelVersion
        }
        sku: {
          capacity: embeddingsModelCapacity
          name: 'Standard'
        }
      }
    ]
    roleAssignments: useOpenAi
      ? [
          {
            principalId: principalId
            principalType: principalType
            roleDefinitionIdOrName: 'Cognitive Services OpenAI User'
          }
          {
            principalId: pizzaApiFunction.outputs.systemAssignedMIPrincipalId
            principalType: 'ServicePrincipal'
            roleDefinitionIdOrName: 'Cognitive Services OpenAI User'
          }
        ]
      : []
  }
}

module cosmosDb 'br/public:avm/res/document-db/database-account:0.12.0' = {
  name: 'cosmosDb'
  scope: resourceGroup
  params: {
    name: '${abbrs.documentDBDatabaseAccounts}${resourceToken}'
    tags: tags
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    managedIdentities: {
      systemAssigned: true
    }
    capabilitiesToAdd: [
      'EnableServerless'
      'EnableNoSQLVectorSearch'
    ]
    networkRestrictions: {
      ipRules: []
      virtualNetworkRules: []
      publicNetworkAccess: 'Enabled'
    }
    sqlDatabases: [
      {
        containers: [
          {
            name: 'orders'
            paths: [
              '/id'
            ]
          }
          {
            name: 'pizzas'
            paths: [
              '/id'
            ]
          }
          {
            name: 'toppings'
            paths: [
              '/id'
            ]
          }
        ]
        name: 'pizzaDB'
      }
      {
        containers: [
          {
            name: 'users'
            paths: [
              '/id'
            ]
          }
        ]
        name: 'userDB'
      }
    ]
    sqlRoleDefinitions: [
      {
        name: 'db-contrib-role-definition'
        roleName: 'Reader Writer'
        roleType: 'CustomRole'
        dataAction: [
          'Microsoft.DocumentDB/databaseAccounts/readMetadata'
          'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/items/*'
          'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/*'
        ]
      }
    ]
    sqlRoleAssignmentsPrincipalIds: [
      principalId
      pizzaApiFunction.outputs.systemAssignedMIPrincipalId
      registrationApiFunction.outputs.systemAssignedMIPrincipalId
    ]
  }
}

module containerApps 'br/public:avm/ptn/azd/container-apps-stack:0.1.1' = {
  name: 'container-apps'
  scope: resourceGroup
  params: {
    containerAppsEnvironmentName: '${abbrs.appManagedEnvironments}${resourceToken}'
    containerRegistryName: '${abbrs.containerRegistryRegistries}${resourceToken}'
    logAnalyticsWorkspaceResourceId: monitoring.outputs.logAnalyticsWorkspaceResourceId
    appInsightsConnectionString: monitoring.outputs.applicationInsightsConnectionString
    acrSku: 'Basic'
    location: location
    acrAdminUserEnabled: true
    zoneRedundant: false
    tags: tags
  }
}

module pizzaMcpIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.4.1' = {
  name: 'pizza-mcp-identity'
  scope: resourceGroup
  params: {
    name: '${abbrs.managedIdentityUserAssignedIdentities}pizza-mcp-${resourceToken}'
    location: location
  }
}

module pizzaMcpContainerApp 'br/public:avm/ptn/azd/container-app-upsert:0.1.2' = {
  name: 'pizza-mcp-container-app'
  scope: resourceGroup
  params: {
    name: pizzaMcpResourceName
    tags: union(tags, { 'azd-service-name': pizzaMcpServiceName })
    location: location
    env: [
      {
        name: 'PIZZA_API_URL'
        value: pizzaApiUrl
      }
    ]
    containerAppsEnvironmentName: containerApps.outputs.environmentName
    containerRegistryName: containerApps.outputs.registryName
    exists: pizzaMcpContainerAppExists
    identityType: 'UserAssigned'
    identityName: pizzaMcpIdentity.name
    containerCpuCoreCount: '2.0'
    containerMemory: '4.0Gi'
    targetPort: 3000
    containerMinReplicas: 1
    containerMaxReplicas: 1
    ingressEnabled: true
    containerName: 'main'
    userAssignedIdentityResourceId: pizzaMcpIdentity.outputs.resourceId
    identityPrincipalId: pizzaMcpIdentity.outputs.principalId
  }
}

// ---------------------------------------------------------------------------
// System roles assignation

module storageRolePizzaApi 'br/public:avm/ptn/authorization/resource-role-assignment:0.1.2' = {
  scope: resourceGroup
  name: 'storage-role-pizza-api'
  params: {
    principalId: pizzaApiFunction.outputs.systemAssignedMIPrincipalId
    roleName: 'Storage Blob Data Contributor'
    roleDefinitionId: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
    resourceId: storage.outputs.resourceId
  }
}

module storageRoleRegistrationApi 'br/public:avm/ptn/authorization/resource-role-assignment:0.1.2' = {
  scope: resourceGroup
  name: 'storage-role-registration-api'
  params: {
    principalId: registrationApiFunction.outputs.systemAssignedMIPrincipalId
    roleName: 'Storage Blob Data Contributor'
    roleDefinitionId: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
    resourceId: storage.outputs.resourceId
  }
}

// ---------------------------------------------------------------------------
// Outputs

output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output AZURE_RESOURCE_GROUP string = resourceGroup.name

output PIZZA_API_URL string = pizzaApiUrl
output PIZZA_MCP_URL string = pizzaMcpUrl
output PIZZA_WEBAPP_URL string = pizzaWebappUrl
output REGISTRATION_API_URL string = registrationApiUrl
output REGISTRATION_WEBAPP_URL string = registrationWebappUrl

output AZURE_STORAGE_URL string = storageUrl
output AZURE_STORAGE_CONTAINER_NAME string = blobContainerName

output AZURE_COSMOSDB_NOSQL_ENDPOINT string = cosmosDb.outputs.endpoint

output AZURE_CONTAINER_ENVIRONMENT_NAME string = containerApps.outputs.environmentName
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerApps.outputs.registryLoginServer
output AZURE_CONTAINER_REGISTRY_NAME string = containerApps.outputs.registryName

output AZURE_OPENAI_ENDPOINT string = openAiUrl
output AZURE_OPENAI_CHAT_DEPLOYMENT_NAME string = chatModelName
output AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT_NAME string = embeddingsModelName
output AZURE_OPENAI_INSTANCE_NAME string = useOpenAi ? openAi.outputs.name : ''
output AZURE_OPENAI_API_VERSION string = openAiApiVersion
