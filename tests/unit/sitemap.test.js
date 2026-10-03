import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseSitemapXml } from '../../src/modules/llms-txt/sitemap.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, '../fixtures');

describe('sitemap parsing', () => {
  it('parses urlset sitemaps', () => {
    const xml = readFileSync(join(fixtures, 'urlset.xml'), 'utf8');
    const parsed = parseSitemapXml(xml);
    expect(parsed.type).toBe('urlset');
    expect(parsed.urls).toContain('https://example.com/about');
  });

  it('parses sitemap index files', () => {
    const xml = readFileSync(join(fixtures, 'sitemap-index.xml'), 'utf8');
    const parsed = parseSitemapXml(xml);
    expect(parsed.type).toBe('index');
    expect(parsed.urls[0]).toContain('sitemap-pages.xml');
  });
});
