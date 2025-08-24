export function initializeTracing() {
  // Only initialize if not already done
  if (process.env.OTEL_INITIALIZED === 'true') {
    return;
  }

  try {
    // Try to import OpenTelemetry modules - fail gracefully if not available
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
    const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');

    const sdk = new NodeSDK({
      serviceName: process.env.SERVICE_NAME || 'chat-api',
      instrumentations: [
        new HttpInstrumentation({
          // Don't instrument health check endpoints
          ignoreIncomingRequestHook: (req: any) => {
            return (
              req.url?.includes('/health') || req.url?.includes('/ping') || false
            );
          },
        }),
        new ExpressInstrumentation(),
      ],
    });

    sdk.start();
    process.env.OTEL_INITIALIZED = 'true';
    console.log('OpenTelemetry instrumentation started');

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      sdk
        .shutdown()
        .then(() => console.log('OpenTelemetry terminated'))
        .catch((error: any) => console.log('Error terminating OpenTelemetry', error))
        .finally(() => process.exit(0));
    });
  } catch (error) {
    console.warn('OpenTelemetry dependencies not found, running without tracing:', error instanceof Error ? error.message : String(error));
    // Set flag to prevent retrying
    process.env.OTEL_INITIALIZED = 'true';
  }
}
