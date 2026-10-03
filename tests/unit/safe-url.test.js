import { describe, expect, it } from 'vitest';
import {
  dedupeUrlEntries,
  isBlockedIpAddress,
  normalizeUrl,
  parseHttpUrl,
} from '../../src/utils/safe-url.js';
import { HttpError } from '../../src/utils/http-error.js';

describe('safe-url', () => {
  it('parses valid https URLs', () => {
    const url = parseHttpUrl('https://example.com/path');
    expect(url.hostname).toBe('example.com');
  });

  it('rejects unsupported protocols', () => {
    expect(() => parseHttpUrl('ftp://example.com')).toThrow(HttpError);
  });

  it('rejects localhost hostnames', () => {
    expect(() => parseHttpUrl('http://localhost/admin')).toThrow(HttpError);
  });

  it('blocks private IPv4 ranges', () => {
    expect(isBlockedIpAddress('127.0.0.1')).toBe(true);
    expect(isBlockedIpAddress('10.0.0.5')).toBe(true);
    expect(isBlockedIpAddress('192.168.1.10')).toBe(true);
    expect(isBlockedIpAddress('8.8.8.8')).toBe(false);
  });

  it('normalizes URLs by removing fragments and trailing slashes', () => {
    expect(normalizeUrl('https://example.com/page/#section')).toBe('https://example.com/page');
    expect(normalizeUrl('https://example.com/page/')).toBe('https://example.com/page');
  });

  it('deduplicates URL entries', () => {
    const deduped = dedupeUrlEntries([
      { url: 'https://example.com/a/', source: 'manual' },
      { url: 'https://example.com/a#x', source: 'sitemap' },
      { url: 'https://other.com/a', source: 'manual' },
    ], 'example.com');

    expect(deduped).toHaveLength(1);
    expect(deduped[0].url).toBe('https://example.com/a');
  });
});
