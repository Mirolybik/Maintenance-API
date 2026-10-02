import pino from 'pino';
import pinoHttp from 'pino-http';
import crypto from 'crypto';

export const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
  customProps: (req) => ({ requestId: req.id }),
  autoLogging: { ignore: (req) => req.url === '/api/health' }
});
