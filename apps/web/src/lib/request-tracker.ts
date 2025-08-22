import Logger from './logger';

// Global state to prevent duplicate API calls during React StrictMode
const globalRequestTracker = new Map<string, Promise<any>>();
const requestTimestamps = new Map<string, number>();

export function trackRequest<T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const lastRequest = requestTimestamps.get(key);

  // If we have a recent request (within 1 second), block duplicate
  if (lastRequest && now - lastRequest < 1000) {
    Logger.request.log(
      '⏸️',
      `Blocking duplicate request within 1s for: ${key}`
    );
    // Return the existing promise if it exists, or make a new one
    if (globalRequestTracker.has(key)) {
      return globalRequestTracker.get(key)!;
    }
  }

  // If request is already in progress, return the existing promise
  if (globalRequestTracker.has(key)) {
    Logger.request.log('🔄', `Request already in progress for: ${key}`);
    return globalRequestTracker.get(key)!;
  }

  // Start new request
  Logger.request.log('🚀', `Starting new request for: ${key}`);
  requestTimestamps.set(key, now);

  const promise = requestFn().finally(() => {
    // Clean up after a delay to handle React StrictMode double effects
    setTimeout(() => {
      globalRequestTracker.delete(key);
    }, 500); // Keep the promise for 500ms to prevent immediate duplicates
  });

  globalRequestTracker.set(key, promise);
  return promise;
}

export function clearRequest(key: string) {
  if (globalRequestTracker.has(key)) {
    Logger.request.log('🗑️', `Clearing request tracker for: ${key}`);
    globalRequestTracker.delete(key);
    requestTimestamps.delete(key);
  }
}
