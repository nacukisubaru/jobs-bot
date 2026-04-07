import fs from 'fs';
import path from 'path';

import { createLogger, format, transports } from 'winston';

const logDir = process.env.LOG_DIR
  ? path.resolve(process.env.LOG_DIR)
  : path.join(process.cwd(), 'logs');
const logPath = path.join(logDir, 'app.log');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

export const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }), // <- важно!
    format.printf(({
      timestamp, level, message, stack, ...meta
    }) => `${timestamp} [${level.toUpperCase()}] ${message} ${stack || ''} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`),
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: logPath }),
  ],
});
