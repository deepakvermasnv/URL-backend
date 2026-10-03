import { describe, expect, it } from 'vitest';
import { parseLlmsTxtRequest } from '../../src/modules/llms-txt/llms-txt.validator.js';

describe('parseLlmsTxtRequest', () => {
  it('accepts website URL input', () => {
    const parsed = parseLlmsTxtRequest({
      websiteUrl: 'https://example.com',
    });
    expect(parsed.websiteUrl).toBe('https://example.com');
  });

  it('rejects maxPages above the server limit', () => {
    expect(() =>
      parseLlmsTxtRequest({
        websiteUrl: 'https://example.com',
        options: { maxPages: 9999 },
      }),
    ).toThrow();
  });

  it('requires at least one input source', () => {
    expect(() => parseLlmsTxtRequest({})).toThrow();
  });
});
