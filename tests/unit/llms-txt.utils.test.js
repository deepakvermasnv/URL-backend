import { describe, expect, it } from 'vitest';
import { sanitizeMarkdownText, shouldSkipUrl } from '../../src/modules/llms-txt/llms-txt.utils.js';

describe('llms-txt utils', () => {
  it('skips admin and checkout URLs', () => {
    expect(shouldSkipUrl('https://example.com/wp-admin/')).toBe(true);
    expect(shouldSkipUrl('https://example.com/checkout')).toBe(true);
    expect(shouldSkipUrl('https://example.com/about')).toBe(false);
  });

  it('sanitizes control characters from text', () => {
    expect(sanitizeMarkdownText('Hello\u0000World')).toBe('HelloWorld');
  });
});
