// OpenTelemetry tracing setup
// This file is loaded automatically by the Azure Functions host,
// as configured in package.json "main" field.

import { useAzureMonitor } from "@azure/monitor-opentelemetry";

let isTracingInitialized = false;
if (!isTracingInitialized) {
  // Initialize tracing and export to Azure Monitor
  const appInsightsConnectionString = process.env["APPLICATIONINSIGHTS_CONNECTION_STRING"];
  if (appInsightsConnectionString) {
    useAzureMonitor({
      azureMonitorExporterOptions: { connectionString: appInsightsConnectionString }
    });
  }

  isTracingInitialized = true;
}
