import { describe, expect, it } from 'vitest';
import { formatErrorResponse, HttpError } from '../../src/utils/http-error.js';

describe('formatErrorResponse', () => {
  it('formats HttpError consistently', () => {
    const body = formatErrorResponse(new HttpError(400, 'INVALID_URL', 'Bad URL'), true);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_URL');
  });

  it('hides internal details in production', () => {
    const body = formatErrorResponse(new Error('secret stack'), true);
    expect(body.error.message).not.toContain('secret');
  });
});
