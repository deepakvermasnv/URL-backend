import { describe, expect, it } from 'vitest';
import { parseLlmsTxtRequest } from '../../src/modules/llms-txt/llms-txt.validator.js';

describe('parseLlmsTxtRequest', () => {
  it('accepts website URL input', () => {
    const parsed = parseLlmsTxtRequest({
      websiteUrl: 'https://example.com',
    });
    expect(parsed.websiteUrl).toBe('https://example.com');
  });

  it('caps maxPages to the server limit', () => {
    const parsed = parseLlmsTxtRequest({
      websiteUrl: 'https://example.com',
      options: { maxPages: 9999 },
    });
    expect(parsed.options.maxPages).toBeLessThanOrEqual(5000);
  });

  it('requires at least one input source', () => {
    expect(() => parseLlmsTxtRequest({})).toThrow();
  });
});
