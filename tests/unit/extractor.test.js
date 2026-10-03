import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractPageContent } from '../../src/modules/llms-txt/extractor.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('extractPageContent', () => {
  it('extracts title, headings, and main text from HTML', () => {
    const html = readFileSync(join(__dirname, '../fixtures/sample-page.html'), 'utf8');
    const result = extractPageContent(html, 'https://example.com/');

    expect(result.title).toContain('Example Company');
    expect(result.h1).toContain('Welcome');
    expect(result.mainText).toContain('practical guides');
    expect(result.internalLinks.some((l) => l.includes('/blog/'))).toBe(true);
    expect(result.limitedContent).toBe(false);
  });
});
