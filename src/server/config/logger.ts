import type { PinoLoggerOptions } from 'fastify/types/logger.js';
import { env } from './env.js';

const isDev = env.NODE_ENV === 'development';

export const loggerConfig: PinoLoggerOptions = isDev
  ? {
      level: 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    }
  : {
      level: 'info',
    };
