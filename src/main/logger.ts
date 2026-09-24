import log from 'electron-log';
import * as path from 'path';

function getLogDir(): string {
  const { app } = require('electron');
  return path.join(app.getPath('logs'), 'Clavis');
}

interface LogContext {
  [key: string]: unknown;
}

function formatContext(context?: LogContext): string {
  if (!context) return '';
  return ' ' + JSON.stringify(context);
}

export function initializeLogger(): void {
  const logDir = getLogDir();
  log.transports.file.resolvePathFn = () => path.join(logDir, 'main.log');
  log.transports.file.level = 'debug';
  log.transports.file.maxSize = 5242880;

  const isDev = process.env.ELECTRON_IS_DEV === '1';
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
