// Environment-based logging utility
const IS_DEV = process.env.NODE_ENV === 'development';
const ENABLE_VERBOSE_LOGS = process.env.NEXT_PUBLIC_VERBOSE_LOGS === 'true';

// Log categories - can be toggled individually
const LOG_CATEGORIES = {
  AUTH: IS_DEV && ENABLE_VERBOSE_LOGS,
  CACHE: IS_DEV && ENABLE_VERBOSE_LOGS,
  API: IS_DEV && ENABLE_VERBOSE_LOGS,
  SOCKET: IS_DEV && ENABLE_VERBOSE_LOGS,
  SCROLL: false, // Usually too noisy
  TIMER: IS_DEV && ENABLE_VERBOSE_LOGS,
  REQUEST: IS_DEV && ENABLE_VERBOSE_LOGS,
} as const;

type LogCategory = keyof typeof LOG_CATEGORIES;

class Logger {
  private static shouldLog(category: LogCategory): boolean {
    return LOG_CATEGORIES[category] || false;
  }

  static log(
    category: LogCategory,
    emoji: string,
    message: string,
    ...args: any[]
  ) {
    if (this.shouldLog(category)) {
      console.log(`${emoji} ${message}`, ...args);
    }
  }

  static error(
    category: LogCategory,
    emoji: string,
    message: string,
    ...args: any[]
  ) {
    if (this.shouldLog(category) || !IS_DEV) {
      // Always show errors in production
      console.error(`${emoji} ${message}`, ...args);
    }
  }

  static warn(
    category: LogCategory,
    emoji: string,
    message: string,
    ...args: any[]
  ) {
    if (this.shouldLog(category)) {
      console.warn(`${emoji} ${message}`, ...args);
    }
  }

  // Specific category loggers
  static auth = {
    log: (emoji: string, message: string, ...args: any[]) =>
      Logger.log('AUTH', emoji, message, ...args),
    error: (emoji: string, message: string, ...args: any[]) =>
      Logger.error('AUTH', emoji, message, ...args),
  };

  static cache = {
    log: (emoji: string, message: string, ...args: any[]) =>
      Logger.log('CACHE', emoji, message, ...args),
    error: (emoji: string, message: string, ...args: any[]) =>
      Logger.error('CACHE', emoji, message, ...args),
  };

  static api = {
    log: (emoji: string, message: string, ...args: any[]) =>
      Logger.log('API', emoji, message, ...args),
    error: (emoji: string, message: string, ...args: any[]) =>
      Logger.error('API', emoji, message, ...args),
  };

  static socket = {
    log: (emoji: string, message: string, ...args: any[]) =>
      Logger.log('SOCKET', emoji, message, ...args),
    error: (emoji: string, message: string, ...args: any[]) =>
      Logger.error('SOCKET', emoji, message, ...args),
  };

  static scroll = {
    log: (emoji: string, message: string, ...args: any[]) =>
      Logger.log('SCROLL', emoji, message, ...args),
  };

  static timer = {
    log: (emoji: string, message: string, ...args: any[]) =>
      Logger.log('TIMER', emoji, message, ...args),
  };

  static request = {
    log: (emoji: string, message: string, ...args: any[]) =>
      Logger.log('REQUEST', emoji, message, ...args),
  };
}

export default Logger;
