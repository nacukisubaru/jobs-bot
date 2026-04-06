import { createLogger, format, transports } from 'winston';

import path from 'path';

const logPath = path.join(__dirname, '../logs/app.log');

export const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({
      timestamp, level, message, stack,
    }) => `${timestamp} [${level.toUpperCase()}] ${stack || message}`),
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: logPath }),
  ],
});
