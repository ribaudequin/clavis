import log from 'electron-log';
import * as path from 'path';
import * as os from 'os';

const LOG_DIR = path.join(os.homedir(), '.config', 'Clavis', 'logs');

interface LogContext {
  [key: string]: unknown;
}

function formatContext(context?: LogContext): string {
  if (!context) return '';
  return ' ' + JSON.stringify(context);
}

export function initializeLogger(): void {
  log.transports.file.resolvePathFn = () => path.join(LOG_DIR, 'main.log');
  log.transports.file.level = 'debug';
  log.transports.file.maxSize = 5242880;

  const isDev = !process.env.ELECTRON_IS_DEV === false;
  log.transports.console.level = isDev ? 'debug' : 'info';

  log.transports.file.format = '{h}:{i}:{s}.{ms} [{level}] {text}';
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    log.debug(message + formatContext(context));
  },
  info: (message: string, context?: LogContext) => {
    log.info(message + formatContext(context));
  },
  warn: (message: string, context?: LogContext) => {
    log.warn(message + formatContext(context));
  },
  error: (message: string, context?: LogContext) => {
    log.error(message + formatContext(context));
  },
};
