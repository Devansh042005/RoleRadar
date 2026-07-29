import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/apiError';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const log = req.log ?? console;

  if (err instanceof ApiError) {
    log.warn({ err, code: err.code }, 'request failed with known error');
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  log.error({ err }, 'unhandled request error');
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}
