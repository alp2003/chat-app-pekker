import { NodeSDK } from '@opentelemetry/sdk-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

export function initializeTracing() {
  // Only initialize if not already done
  if (process.env.OTEL_INITIALIZED === 'true') {
    return;
  }

  const sdk = new NodeSDK({
    serviceName: process.env.SERVICE_NAME || 'chat-api',
    instrumentations: [
      new HttpInstrumentation({
        // Don't instrument health check endpoints
        ignoreIncomingRequestHook: (req) => {
          return (
            req.url?.includes('/health') || req.url?.includes('/ping') || false
          );
        },
      }),
      new ExpressInstrumentation(),
    ],
  });

  try {
    sdk.start();
    process.env.OTEL_INITIALIZED = 'true';
    console.log('OpenTelemetry instrumentation started');
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry:', error);
  }

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('OpenTelemetry terminated'))
      .catch((error) => console.log('Error terminating OpenTelemetry', error))
      .finally(() => process.exit(0));
  });
}
