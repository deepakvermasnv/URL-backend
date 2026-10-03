import { readFileSync } from 'node:fs';
import dns from 'node:dns/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, '../fixtures');

const sampleHtml = readFileSync(join(fixtures, 'sample-page.html'), 'utf8');
const urlsetXml = readFileSync(join(fixtures, 'urlset.xml'), 'utf8');

function mockFetchRouter(url) {
  const u = String(url);

  if (u.includes('example.com/sitemap.xml')) {
    return {
      ok: true,
      status: 200,
      headers: { get: (k) => (k === 'content-type' ? 'application/xml' : null) },
      body: {
        getReader: () => {
          const encoder = new TextEncoder();
          const bytes = encoder.encode(urlsetXml);
          let sent = false;
          return {
            read: async () => {
              if (sent) return { done: true, value: undefined };
              sent = true;
              return { done: false, value: bytes };
            },
            cancel: async () => {},
          };
        },
      },
    };
  }

  if (u.includes('example.com')) {
    return {
      ok: true,
      status: 200,
      headers: { get: (k) => (k === 'content-type' ? 'text/html; charset=utf-8' : null) },
      body: {
        getReader: () => {
          const encoder = new TextEncoder();
          const bytes = encoder.encode(sampleHtml);
          let sent = false;
          return {
            read: async () => {
              if (sent) return { done: true, value: undefined };
              sent = true;
              return { done: false, value: bytes };
            },
            cancel: async () => {},
          };
        },
      },
    };
  }

  return {
    ok: false,
    status: 404,
    headers: { get: () => 'text/plain' },
    body: {
      getReader: () => ({
        read: async () => ({ done: true, value: undefined }),
        cancel: async () => {},
      }),
    },
  };
}

describe('API integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url) => mockFetchRouter(url)));
    vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('GET /api/v1/health returns ok', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  it('POST /api/v1/llms-txt/preview analyzes pages', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/llms-txt/preview')
      .send({ websiteUrl: 'https://example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stats.processed).toBeGreaterThan(0);
    expect(res.body.data.content).toBeUndefined();
  });

  it('POST /api/v1/llms-txt/generate returns llms.txt content', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/llms-txt/generate')
      .send({
        websiteUrl: 'https://example.com',
        sitemapUrl: 'https://example.com/sitemap.xml',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toContain('# Example Company');
    expect(res.body.data.filename).toContain('llms.txt');
  });

  it('returns validation error for empty body', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/llms-txt/generate').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unsafe localhost URLs', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/llms-txt/generate')
      .send({ websiteUrl: 'http://localhost:5000' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNSAFE_URL');
  });

  it('continues when individual pages fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        if (String(url).includes('/about')) {
          return {
            ok: false,
            status: 500,
            headers: { get: () => 'text/html' },
            body: {
              getReader: () => ({
                read: async () => ({ done: true, value: undefined }),
                cancel: async () => {},
              }),
            },
          };
        }
        return mockFetchRouter(url);
      }),
    );

    const app = createApp();
    const res = await request(app)
      .post('/api/v1/llms-txt/generate')
      .send({
        websiteUrl: 'https://example.com',
        pageUrls: ['https://example.com/about'],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.stats.failed).toBeGreaterThan(0);
    expect(res.body.data.content).toContain('# Example Company');
  });
});
