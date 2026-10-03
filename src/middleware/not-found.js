import { HttpError } from '../utils/http-error.js';

/**
 * @param {import('express').Request} _req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
export function notFoundHandler(_req, _res, next) {
  next(new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.'));
}
