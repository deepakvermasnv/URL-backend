export class HttpError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * @param {unknown} err
 * @param {boolean} isProduction
 */
export function formatErrorResponse(err, isProduction) {
  if (err instanceof HttpError) {
    return {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && !isProduction ? { details: err.details } : {}),
      },
    };
  }

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction
        ? 'An unexpected error occurred.'
        : err instanceof Error
          ? err.message
          : 'Unknown error',
    },
  };
}
