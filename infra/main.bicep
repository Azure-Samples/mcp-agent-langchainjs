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
param burgerApiServiceName string = 'burger-api'
param burgerMcpServiceName string = 'burger-mcp'
param burgerWebappName string = 'burger-website'
param agentApiServiceName string = 'agent-api'
param agentWebappName string = 'agent-website'
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

param burgerMcpContainerAppExists bool = false

// ---------------------------------------------------------------------------
// Common variables

var abbrs = loadJsonContent('abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }

var principalType = isContinuousIntegration ? 'ServicePrincipal' : 'User'
var burgerApiResourceName = '${abbrs.webSitesFunctions}burger-api-${resourceToken}'
var burgerMcpResourceName = '${abbrs.appContainerApps}burger-mcp-${resourceToken}'
var agentApiResourceName = '${abbrs.webSitesFunctions}agent-api-${resourceToken}'
var storageAccountName = '${abbrs.storageStorageAccounts}${resourceToken}'
var openAiUrl = 'https://${openAi.outputs.name}.openai.azure.com'
var storageUrl = 'https://${storage.outputs.name}.blob.${environment().suffixes.storage}'
var burgerApiUrl = 'https://${burgerApiFunction.outputs.defaultHostname}'
var burgerMcpUrl = burgerMcpContainerApp.outputs.uri
var burgerWebappUrl = 'https://${burgerWebapp.outputs.defaultHostname}'
var agentApiUrl = 'https://${agentApiFunction.outputs.defaultHostname}'
var agentWebappUrl = 'https://${agentWebapp.outputs.defaultHostname}'

// ---------------------------------------------------------------------------
// Resources

resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: !empty(resourceGroupName) ? resourceGroupName : '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

module burgerApiFunction 'br/public:avm/res/web/site:0.16.0' = {
  name: 'burger-api'
  scope: resourceGroup
  params: {
    tags: union(tags, { 'azd-service-name': burgerApiServiceName })
    location: location
    kind: 'functionapp,linux'
    name: burgerApiResourceName
    serverFarmResourceId: burgerApiAppServicePlan.outputs.resourceId
    configs: [
      {
        name: 'appsettings'
        applicationInsightResourceId: monitoring.outputs.applicationInsightsResourceId
        storageAccountResourceId: storage.outputs.resourceId
        storageAccountUseIdentityAuthentication: true
      }
    ]
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
          value: '${storage.outputs.primaryBlobEndpoint}${burgerApiResourceName}'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      scaleAndConcurrency: {
        alwaysReady: [
          {
            name: 'http'
            instanceCount: 1
          }
        ]
        maximumInstanceCount: 100
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'node'
        version: '20'
      }
    }
  }
}

// Needed to avoid circular resource dependencies
// TODO: child module?
module burgerApiFunctionSettings './core/site-app-settings.bicep' = {
  name: 'burger-api-settings'
  scope: resourceGroup
  params: {
    appName: burgerApiFunction.outputs.name
    kind: 'functionapp,linux'
    appSettingsKeyValuePairs: {
      AZURE_STORAGE_URL: storageUrl
      AZURE_STORAGE_CONTAINER_NAME: blobContainerName
      AZURE_COSMOSDB_NOSQL_ENDPOINT: cosmosDb.outputs.endpoint
    }
    storageAccountResourceId: storage.outputs.resourceId
    storageAccountUseIdentityAuthentication: true
    appInsightResourceId: monitoring.outputs.applicationInsightsResourceId
  }
}

module agentApiFunction 'br/public:avm/res/web/site:0.13.0' = {
  name: 'agent-api'
  scope: resourceGroup
  params: {
    tags: union(tags, { 'azd-service-name': agentApiServiceName })
    location: location
    kind: 'functionapp,linux'
    name: agentApiResourceName
    serverFarmResourceId: agentApiAppServicePlan.outputs.resourceId
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
          value: '${storage.outputs.primaryBlobEndpoint}${burgerMcpResourceName}'
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

module burgerApiAppServicePlan 'br/public:avm/res/web/serverfarm:0.4.1' = {
  name: 'burger-api-appserviceplan'
  scope: resourceGroup
  params: {
    name: '${abbrs.webServerFarms}burger-api-${resourceToken}'
    tags: tags
    location: location
    skuName: 'FC1'
    reserved: true
  }
}

module burgerWebapp 'br/public:avm/res/web/static-site:0.9.0' = {
  name: 'burger-webapp'
  scope: resourceGroup
  params: {
    name: burgerWebappName
    location: webappLocation
    tags: union(tags, { 'azd-service-name': burgerWebappName })
  }
}

module agentApiAppServicePlan 'br/public:avm/res/web/serverfarm:0.4.1' = {
  name: 'agent-api-appserviceplan'
  scope: resourceGroup
  params: {
    name: '${abbrs.webServerFarms}agent-api-${resourceToken}'
    tags: tags
    location: location
    skuName: 'FC1'
    reserved: true
  }
}

// Needed to avoid circular resource dependencies
module agentApiFunctionSettings './core/site-app-settings.bicep' = {
  name: 'agent-api-settings'
  scope: resourceGroup
  params: {
    appName: agentApiFunction.outputs.name
    kind: 'functionapp,linux'
    appSettingsKeyValuePairs: {
      AZURE_COSMOSDB_NOSQL_ENDPOINT: cosmosDb.outputs.endpoint
      AZURE_OPENAI_ENDPOINT: openAiUrl
      AZURE_OPENAI_CHAT_DEPLOYMENT_NAME: chatModelName
      AZURE_OPENAI_INSTANCE_NAME: openAi.outputs.name
      AZURE_OPENAI_API_VERSION: openAiApiVersion
    }
    storageAccountResourceId: storage.outputs.resourceId
    storageAccountUseIdentityAuthentication: true
    appInsightResourceId: monitoring.outputs.applicationInsightsResourceId
  }
}

module agentWebapp 'br/public:avm/res/web/static-site:0.9.0' = {
  name: 'agent-webapp'
  scope: resourceGroup
  params: {
    name: agentWebappName
    location: webappLocation
    tags: union(tags, { 'azd-service-name': agentWebappName })
    sku: 'Standard'
    linkedBackend: {
      resourceId: agentApiFunction.outputs.resourceId
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
          name: burgerApiResourceName
        }
        {
          name: burgerMcpResourceName
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

module openAi 'br/public:avm/res/cognitive-services/account:0.10.2' = {
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
    ]
    roleAssignments: [
      {
        principalId: principalId
        principalType: principalType
        roleDefinitionIdOrName: 'Cognitive Services OpenAI User'
      }
      {
        principalId: agentApiFunction.outputs.systemAssignedMIPrincipalId
        principalType: 'ServicePrincipal'
        roleDefinitionIdOrName: 'Cognitive Services OpenAI User'
      }
    ]
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
            name: 'burgers'
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
        name: 'burgerDB'
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
      burgerApiFunction.outputs.systemAssignedMIPrincipalId
      agentApiFunction.outputs.systemAssignedMIPrincipalId
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

module burgerMcpIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.4.1' = {
  name: 'burger-mcp-identity'
  scope: resourceGroup
  params: {
    name: '${abbrs.managedIdentityUserAssignedIdentities}burger-mcp-${resourceToken}'
    location: location
  }
}

module burgerMcpContainerApp 'br/public:avm/ptn/azd/container-app-upsert:0.1.2' = {
  name: 'burger-mcp-container-app'
  scope: resourceGroup
  params: {
    name: burgerMcpResourceName
    tags: union(tags, { 'azd-service-name': burgerMcpServiceName })
    location: location
    env: [
      {
        name: 'BURGER_API_URL'
        value: burgerApiUrl
      }
    ]
    containerAppsEnvironmentName: containerApps.outputs.environmentName
    containerRegistryName: containerApps.outputs.registryName
    exists: burgerMcpContainerAppExists
    identityType: 'UserAssigned'
    identityName: burgerMcpIdentity.name
    containerCpuCoreCount: '2.0'
    containerMemory: '4.0Gi'
    targetPort: 3000
    containerMinReplicas: 1
    containerMaxReplicas: 1
    ingressEnabled: true
    containerName: 'main'
    userAssignedIdentityResourceId: burgerMcpIdentity.outputs.resourceId
    identityPrincipalId: burgerMcpIdentity.outputs.principalId
  }
}

// ---------------------------------------------------------------------------
// System roles assignation

module storageRoleBurgerApi 'br/public:avm/ptn/authorization/resource-role-assignment:0.1.2' = {
  scope: resourceGroup
  name: 'storage-role-burger-api'
  params: {
    principalId: burgerApiFunction.outputs.systemAssignedMIPrincipalId
    roleName: 'Storage Blob Data Contributor'
    roleDefinitionId: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
    resourceId: storage.outputs.resourceId
  }
}

module storageRoleRegistrationApi 'br/public:avm/ptn/authorization/resource-role-assignment:0.1.2' = {
  scope: resourceGroup
  name: 'storage-role-agent-api'
  params: {
    principalId: agentApiFunction.outputs.systemAssignedMIPrincipalId
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

output BURGER_API_URL string = burgerApiUrl
output BURGER_MCP_URL string = burgerMcpUrl
output BURGER_WEBAPP_URL string = burgerWebappUrl
output AGENT_API_URL string = agentApiUrl
output AGENT_WEBAPP_URL string = agentWebappUrl

output AZURE_STORAGE_URL string = storageUrl
output AZURE_STORAGE_CONTAINER_NAME string = blobContainerName

output AZURE_COSMOSDB_NOSQL_ENDPOINT string = cosmosDb.outputs.endpoint

output AZURE_CONTAINER_ENVIRONMENT_NAME string = containerApps.outputs.environmentName
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerApps.outputs.registryLoginServer
output AZURE_CONTAINER_REGISTRY_NAME string = containerApps.outputs.registryName

output AZURE_OPENAI_ENDPOINT string = openAiUrl
output AZURE_OPENAI_CHAT_DEPLOYMENT_NAME string = chatModelName
output AZURE_OPENAI_INSTANCE_NAME string = openAi.outputs.name
output AZURE_OPENAI_API_VERSION string = openAiApiVersion
