import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crawlPages } from '../../src/modules/llms-txt/crawler.service.js';

describe('crawlPages deep crawl', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        const u = String(url);
        if (u === 'https://example.com/') {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'text/html' },
            body: {
              getReader: () => {
                const bytes = new TextEncoder().encode(
                  '<html><head><title>Home</title><meta name="description" content="Home page"></head><body><h1>Home</h1><a href="/page1">Page 1</a></body></html>',
                );
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
        if (u === 'https://example.com/page1') {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'text/html' },
            body: {
              getReader: () => {
                const bytes = new TextEncoder().encode(
                  '<html><head><title>Page 1</title><meta name="description" content="Subpage 1"></head><body><h1>Page 1</h1><a href="/page2">Page 2</a></body></html>',
                );
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
        if (u === 'https://example.com/page2') {
          return {
            ok: true,
            status: 200,
            headers: { get: () => 'text/html' },
            body: {
              getReader: () => {
                const bytes = new TextEncoder().encode(
                  '<html><head><title>Page 2</title><meta name="description" content="Subpage 2"></head><body><h1>Page 2</h1></body></html>',
                );
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
        return { ok: false, status: 404, headers: { get: () => 'text/plain' } };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('recursively discovers internal links during crawl', async () => {
    const result = await crawlPages([{ url: 'https://example.com/', source: 'homepage' }], {
      maxPages: 10,
      allowedHost: 'example.com',
      deepCrawl: true,
    });

    expect(result.stats.discovered).toBe(3);
    expect(result.stats.processed).toBe(3);
    const urls = result.pages.map((p) => p.url);
    expect(urls).toContain('https://example.com/');
    expect(urls).toContain('https://example.com/page1');
    expect(urls).toContain('https://example.com/page2');
  });
});
