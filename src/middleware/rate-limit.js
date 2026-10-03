import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

export const generationRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler(_req, _res, next) {
    next(new HttpError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.'));
  },
});
