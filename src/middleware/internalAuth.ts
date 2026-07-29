import type { NextFunction, Request, Response } from 'express';

const LOCALHOST_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * /internal/* exposes extraction stats and job queue counts — not secrets, but not
 * meant for public traffic either. Accept either a direct localhost connection (the
 * common case: an ops box or admin dashboard hitting the API from the same host/VPC)
 * or a shared-secret header, so it isn't just "publicly reachable but rate-limited".
 */
export function internalOnly(req: Request, res: Response, next: NextFunction) {
  const secret = process.env.INTERNAL_API_SECRET;
  const providedSecret = req.header('x-internal-secret');

  if (secret && providedSecret === secret) {
    next();
    return;
  }

  if (LOCALHOST_IPS.has(req.socket.remoteAddress ?? '')) {
    next();
    return;
  }

  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
}
