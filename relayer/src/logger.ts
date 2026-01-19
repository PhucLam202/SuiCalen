import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts }) => {
  return `${ts} [${level}]: ${message}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp(), colorize(), logFormat),
  transports: [new winston.transports.Console()]
});

export type Logger = typeof logger;

