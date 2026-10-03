import express from 'express';
import helmet from 'helmet';
import { corsMiddleware } from './config/cors.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestLogger } from './middleware/request-logger.js';
import apiRoutes from './routes/index.js';
import { HttpError } from './utils/http-error.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(corsMiddleware);
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
  app.use(requestLogger);

  app.use('/api/v1', apiRoutes);

  app.use(notFoundHandler);

  app.use((err, req, res, next) => {
    if (err instanceof Error && err.message === 'Not allowed by CORS') {
      return next(new HttpError(403, 'CORS_NOT_ALLOWED', 'Origin not allowed by CORS policy.'));
    }
    return next(err);
  });

  app.use(errorHandler);

  return app;
}
