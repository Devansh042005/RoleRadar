import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { healthRouter } from './routes/health';
import { internalJobsRouter } from './routes/internalJobs';
import { internalExtractionRouter } from './routes/internalExtraction';
import { analyticsRouter } from './routes/analytics';
import { applicationsRouter } from './routes/applications';
import { scheduleSourcePolling } from './queues/sourcePollQueue';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createRateLimiter } from './middleware/rateLimit';
import { logger } from './lib/logger';

const app = express();
const PORT = process.env.PORT ?? 3000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

// Behind a single reverse proxy/load balancer in production, so req.ip reflects the
// real client for rate limiting instead of the proxy's address.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: '100kb' }));
app.use(requestLogger);

const globalRateLimiter = createRateLimiter({ keyPrefix: 'rl:global', points: 100, duration: 60 });
const analyticsRateLimiter = createRateLimiter({ keyPrefix: 'rl:analytics', points: 30, duration: 60 });

app.use(globalRateLimiter);

app.use(healthRouter);
app.use(internalJobsRouter);
app.use(internalExtractionRouter);
app.use('/api/analytics', analyticsRateLimiter);
app.use(analyticsRouter);
app.use(applicationsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, async () => {
  logger.info(`Server listening on port ${PORT}`);
  await scheduleSourcePolling();
  logger.info('source-poll repeatable job registered');
});

// Guards against slow-client / hung-request resource exhaustion.
server.requestTimeout = 30_000;
server.headersTimeout = 31_000;
