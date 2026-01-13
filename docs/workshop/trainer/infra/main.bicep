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
  'uksouth'
  'swedencentral'
  'eastus'
  'eastus2'
  'southcentralus'
  'westus2'
  'westus3'
  'eastasia'
  'southeastasia'
  'australiaeast'
])
param location string

param resourceGroupName string = ''
param openAiProxyServiceName string = 'openai-proxy'

@description('Location(s) for the AI Foundry resource group')
// @allowed([
//   // Regions where gpt-5-mini is available,
//   // see https://learn.microsoft.com/azure/ai-foundry/foundry-models/concepts/models-sold-directly-by-azure?pivots=azure-openai&tabs=global-standard-aoai%2Cstandard-chat-completions%2Cglobal-standard#global-standard-model-availability
//   'australiaeast'
//   'eastus'
//   'eastus2'
//   'japaneast'
//   'koreacentral'
//   'sounthindia'
//   'swedencentral'
//   'switzerlandnorth'
//   'uksouth'
// ])
// @metadata({
//   azd: {
//     type: 'location'
//   }
// })
param aiServicesLocation string // Set in main.parameters.json
param defaultModelName string // Set in main.parameters.json
param defaultModelVersion string // Set in main.parameters.json
param defaultModelCapacity int // Set in main.parameters.json

// Id of the user or app to assign application roles
param principalId string = ''

// Differentiates between automated and manual deployments
param isContinuousIntegration bool // Set in main.parameters.json

// ---------------------------------------------------------------------------
// Common variables

var abbrs = loadJsonContent('abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }

var principalType = isContinuousIntegration ? 'ServicePrincipal' : 'User'
var openAiProxyResourceName = '${abbrs.webSitesFunctions}burger-mcp-${resourceToken}'
var storageAccountName = '${abbrs.storageStorageAccounts}${resourceToken}'
// var openAiUrl = 'https://${aiFoundry.outputs.aiServicesName}.openai.azure.com'
var openAiProxyUrl = 'https://${openAiProxyFunction.outputs.defaultHostname}/openai/v1'
var aiLocations = split(aiServicesLocation, ',')
var openAiUrl = join(map(aiFoundryResources, aiFoundryResource => 'https://${aiFoundryResource.outputs.aiServicesName}.openai.azure.com'), ',')

// ---------------------------------------------------------------------------
// Resources

resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: !empty(resourceGroupName) ? resourceGroupName : '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

module openAiProxyFunction 'br/public:avm/res/web/site:0.16.1' = {
  name: 'openai-proxy'
  scope: resourceGroup
  params: {
    tags: union(tags, { 'azd-service-name': openAiProxyServiceName })
    location: location
    kind: 'functionapp,linux'
    name: openAiProxyResourceName
    serverFarmResourceId: openAiProxyAppServicePlan.outputs.resourceId
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
          value: '${storage.outputs.primaryBlobEndpoint}${openAiProxyResourceName}'
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
        version: '22'
      }
    }
  }
}

// Needed to avoid circular resource dependencies
module openAiProxyFunctionSettings 'br/public:avm/res/web/site/config:0.1.0' = {
  name: 'burger-mcp-settings'
  scope: resourceGroup
  params: {
    name: 'appsettings'
    appName: openAiProxyFunction.outputs.name
    properties: {
      AzureWebJobsFeatureFlags: 'EnableMcpCustomHandlerPreview'
      AZURE_OPENAI_API_ENDPOINT: openAiUrl
    }
    storageAccountResourceId: storage.outputs.resourceId
    storageAccountUseIdentityAuthentication: true
    applicationInsightResourceId: monitoring.outputs.applicationInsightsResourceId
  }
}

module openAiProxyAppServicePlan 'br/public:avm/res/web/serverfarm:0.4.1' = {
  name: 'openai-proxy-appserviceplan'
  scope: resourceGroup
  params: {
    name: '${abbrs.webServerFarms}openai-proxy-${resourceToken}'
    tags: tags
    location: location
    skuName: 'FC1'
    reserved: true
  }
}

module storage 'br/public:avm/res/storage/storage-account:0.26.2' = {
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
          name: openAiProxyResourceName
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

module monitoring 'br/public:avm/ptn/azd/monitoring:0.2.1' = {
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

module aiFoundryResources 'br/public:avm/ptn/ai-ml/ai-foundry:0.4.0' = [for (aiLocation, i) in aiLocations: {
  name: 'aiFoundry${i}'
  scope: resourceGroup
  params: {
    baseName: '${substring(resourceToken, 0, 10)}-${i}' // Max 12 chars
    tags: tags
    location: aiLocation
    aiFoundryConfiguration: {
      roleAssignments: [
        {
          principalId: principalId
          principalType: principalType
          roleDefinitionIdOrName: 'Cognitive Services OpenAI User'
        }
        {
          principalId: openAiProxyFunction.outputs.?systemAssignedMIPrincipalId!
          principalType: 'ServicePrincipal'
          roleDefinitionIdOrName: 'Cognitive Services OpenAI User'
       }
      ]
    }
    aiModelDeployments: [
      {
        name: defaultModelName
        model: {
          format: 'OpenAI'
          name: defaultModelName
          version: defaultModelVersion
        }
        sku: {
          capacity: defaultModelCapacity
          name: 'GlobalStandard'
        }
      }
    ]
  }
}]

// ---------------------------------------------------------------------------
// System roles assignation

module storageRoleOpenAiProxy 'br/public:avm/ptn/authorization/resource-role-assignment:0.1.2' = {
  scope: resourceGroup
  name: 'storage-role-openai-proxy'
  params: {
    principalId: openAiProxyFunction.outputs.?systemAssignedMIPrincipalId!
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

output AZURE_OPENAI_API_ENDPOINTS string = openAiUrl
output AZURE_OPENAI_MODEL string = defaultModelName

output OPENAI_PROXY_URL string = openAiProxyUrl
