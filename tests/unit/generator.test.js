import { describe, expect, it } from 'vitest';
import { generateLlmsTxt } from '../../src/modules/llms-txt/generator.service.js';

describe('generateLlmsTxt', () => {
  it('builds markdown sections from extracted pages', () => {
    const content = generateLlmsTxt(
      [
        {
          url: 'https://example.com/',
          canonical: 'https://example.com/',
          title: 'Example Company',
          pageDescription: 'Helpful online tools for marketers.',
          limitedContent: false,
        },
        {
          url: 'https://example.com/tools/url-trim',
          canonical: 'https://example.com/tools/url-trim',
          title: 'URL Trim Tool',
          pageDescription: 'Shorten and clean URLs.',
          limitedContent: false,
        },
      ],
      {
        siteOrigin: 'https://example.com',
        siteName: 'Example Company',
        siteTagline: 'Helpful online tools for marketers.',
      },
    );

    expect(content.startsWith('# Example Company')).toBe(true);
    expect(content).toContain('## Important Pages');
    expect(content).toContain('[URL Trim Tool](https://example.com/tools/url-trim)');
  });
});
