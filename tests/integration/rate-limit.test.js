import dns from 'node:dns/promises';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('generation rate limiting', () => {
  beforeEach(() => {
    vi.stubEnv('RATE_LIMIT_MAX_REQUESTS', '2');
    vi.stubEnv('RATE_LIMIT_WINDOW_MS', '60000');
    vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns 429 after exceeding the configured limit', async () => {
    vi.resetModules();
    const { createApp } = await import('../../src/app.js');
    const app = createApp();

    const payload = { websiteUrl: 'http://127.0.0.1' };

    await request(app).post('/api/v1/llms-txt/preview').send(payload);
    await request(app).post('/api/v1/llms-txt/preview').send(payload);
    const third = await request(app).post('/api/v1/llms-txt/preview').send(payload);

    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
