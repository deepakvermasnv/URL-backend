import { formatErrorResponse } from '../utils/http-error.js';
import { env } from '../config/env.js';

/**
 * @param {unknown} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorHandler(err, req, res, _next) {
  const isProduction = env.NODE_ENV === 'production';
  const body = formatErrorResponse(err, isProduction);
  const statusCode = err && typeof err === 'object' && 'statusCode' in err ? err.statusCode : 500;

  if (statusCode >= 500) {
    console.error(JSON.stringify({
      event: 'error',
      path: req.originalUrl,
      code: body.error.code,
      message: err instanceof Error ? err.message : 'Unknown',
    }));
  }

  res.status(statusCode).json(body);
}
