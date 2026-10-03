import { env } from '../../config/env.js';
import { safeFetchGet } from '../../utils/safe-fetch.js';
import { normalizeUrl } from '../../utils/safe-url.js';
import { extractPageContent } from './extractor.service.js';
import { isPathDisallowed } from './robots.service.js';
import { shouldSkipUrl } from './llms-txt.utils.js';

/**
 * @param {number} ms
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simple concurrency pool.
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<void>} worker
 */
async function mapPool(items, concurrency, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current], current);
      if (env.CRAWL_DELAY_MS > 0) {
        await delay(env.CRAWL_DELAY_MS);
      }
    }
  });
  await Promise.all(runners);
}

/**
 * @param {string} homepageUrl
 * @param {number} limit
 */
export async function discoverHomepageLinks(homepageUrl, limit = 20) {
  const response = await safeFetchGet(homepageUrl, { acceptHtml: true });
  if (!response.ok) {
    return [];
  }

  const extracted = extractPageContent(response.text, response.finalUrl);
  const origin = new URL(homepageUrl).origin;
  const links = extracted.internalLinks
    .map((href) => {
      try {
        return normalizeUrl(href, origin);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const unique = [...new Set([normalizeUrl(homepageUrl), ...links])];
  return unique.filter((u) => !shouldSkipUrl(u)).slice(0, limit);
}

/**
 * @param {Array<{ url: string; source: string }>} urlEntries
 * @param {{ disallowPaths?: string[]; maxPages?: number }} [options]
 */
export async function crawlPages(urlEntries, options = {}) {
  const maxPages = Math.min(options.maxPages ?? env.MAX_PAGES, env.MAX_PAGES);
  const disallowPaths = options.disallowPaths ?? [];
  const warnings = [];

  const toFetch = urlEntries.slice(0, maxPages);
  /** @type {import('./extractor.service.js').extractPageContent extends (...args: any) => infer R ? R[] : never} */
  const pages = [];

  await mapPool(toFetch, env.CRAWL_CONCURRENCY, async (entry) => {
    const { url, source } = entry;

    if (shouldSkipUrl(url)) {
      pages.push({
        url,
        source,
        success: false,
        skipped: true,
        error: 'URL skipped by crawl rules.',
      });
      return;
    }

    try {
      const path = new URL(url).pathname;
      if (isPathDisallowed(path, disallowPaths)) {
        pages.push({
          url,
          source,
          success: false,
          skipped: true,
          error: 'Disallowed by robots.txt',
        });
        return;
      }

      const response = await safeFetchGet(url, { acceptHtml: true });
      if (!response.ok) {
        pages.push({
          url,
          source,
          success: false,
          error: `HTTP ${response.status}`,
        });
        return;
      }

      const extracted = extractPageContent(response.text, response.finalUrl);
      pages.push({
        ...extracted,
        source,
        success: true,
      });
    } catch (err) {
      pages.push({
        url,
        source,
        success: false,
        error: err instanceof Error ? err.message : 'Fetch failed',
      });
    }
  });

  for (const page of pages) {
    if (page.warnings?.length) {
      warnings.push(...page.warnings.map((w) => `${page.url}: ${w}`));
    }
  }

  const processed = pages.filter((p) => p.success).length;

  return {
    pages,
    stats: {
      discovered: urlEntries.length,
      processed,
      failed: urlEntries.length - processed,
      fetched: processed,
    },
    warnings,
  };
}
