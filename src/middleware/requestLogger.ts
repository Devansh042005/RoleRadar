import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import { logger } from '../lib/logger';

export const requestLogger = pinoHttp({
  logger,
  // Cookies and auth headers must never land in server logs in plaintext, even
  // though this API doesn't use cookie auth itself — a browser can send arbitrary
  // cookies for the origin, and pino-http's default serializer logs headers verbatim.
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-internal-secret"]'],
    censor: '[redacted]',
  },
  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    const id = typeof existing === 'string' && existing.length > 0 ? existing : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});
