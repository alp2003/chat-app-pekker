import { loggerFactory } from './logger.factory';

describe('Logger Factory', () => {
  it('should create a logger with context', () => {
    const logger = loggerFactory.createLogger({
      requestId: 'test-request-id',
      correlationId: 'test-correlation-id',
      userId: 'test-user-id',
    });

    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should create base logger', () => {
    const logger = loggerFactory.getBaseLogger();
    
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });
});
