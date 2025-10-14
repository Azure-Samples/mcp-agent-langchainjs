// OpenTelemetry tracing setup
// This file is loaded automatically by the Azure Functions host,
// as configured in package.json "main" field.

import { useAzureMonitor } from '@azure/monitor-opentelemetry';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { LangChainInstrumentation } from '@arizeai/openinference-instrumentation-langchain';
import * as CallbackManagerModule from '@langchain/core/callbacks/manager';

let isTracingInitialized = false;
if (!isTracingInitialized) {
  // Initialize tracing and export to Azure Monitor or OTLP endpoint
  // When running locally, you can use a local OpenTelemetry collector to receive the traces,
  // for example VS Code AI Toolkit's extension trace collector:
  // https://marketplace.visualstudio.com/items?itemName=ms-windows-ai-studio.windows-ai-studio
  const appInsightsConnectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (appInsightsConnectionString) {
    useAzureMonitor({
      azureMonitorExporterOptions: { connectionString: appInsightsConnectionString },
    });
  } else {
    console.warn(
      'Using local OTLP endpoint at http://localhost:4318, run a local OpenTelemetry collector to receive the traces',
    );

    const exporter = new OTLPTraceExporter({
      url: 'http://localhost:4318/v1/traces',
    });
    const provider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter as any) as any],
    });
    provider.register();
  }

  // Manually instrument LangChain's CallbackManager to capture traces
  const langchainInstrumentation = new LangChainInstrumentation();
  langchainInstrumentation.manuallyInstrument(CallbackManagerModule);

  isTracingInitialized = true;
}
