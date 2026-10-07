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
export async function discoverHomepageLinks(homepageUrl, limit = env.MAX_PAGES) {
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
 * @param {{ disallowPaths?: string[]; maxPages?: number; allowedHost?: string; includeBlogs?: boolean; deepCrawl?: boolean }} [options]
 */
export async function crawlPages(urlEntries, options = {}) {
  const maxPages = Math.min(options.maxPages ?? env.MAX_PAGES, env.MAX_PAGES);
  const disallowPaths = options.disallowPaths ?? [];
  const includeBlogs = options.includeBlogs ?? true;
  const allowedHost = options.allowedHost;
  const deepCrawl = options.deepCrawl ?? true;
  const warnings = [];

  const queue = [];
  const seen = new Set();

  for (const entry of urlEntries) {
    if (queue.length >= maxPages) break;
    try {
      const norm = normalizeUrl(entry.url);
      if (!seen.has(norm)) {
        seen.add(norm);
        queue.push({ url: norm, source: entry.source });
      }
    } catch {
      // skip invalid seed
    }
  }

  /** @type {import('./extractor.service.js').extractPageContent extends (...args: any) => infer R ? R[] : never} */
  const pages = [];
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < queue.length && pages.length < maxPages) {
      const current = currentIndex;
      currentIndex += 1;
      const entry = queue[current];
      if (!entry) break;

      const { url, source } = entry;

      if (shouldSkipUrl(url)) {
        pages.push({
          url,
          source,
          success: false,
          skipped: true,
          error: 'URL skipped by crawl rules.',
        });
        continue;
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
          continue;
        }

        const response = await safeFetchGet(url, { acceptHtml: true });
        if (!response.ok) {
          pages.push({
            url,
            source,
            success: false,
            error: `HTTP ${response.status}`,
          });
          continue;
        }

        const extracted = extractPageContent(response.text, response.finalUrl);
        pages.push({
          ...extracted,
          source,
          success: true,
        });

        if (deepCrawl && queue.length < maxPages) {
          const origin = new URL(url).origin;
          for (const linkHref of extracted.internalLinks || []) {
            if (queue.length >= maxPages) break;
            try {
              const normLink = normalizeUrl(linkHref, origin);
              if (allowedHost && new URL(normLink).hostname.toLowerCase() !== allowedHost) {
                continue;
              }
              if (seen.has(normLink)) continue;
              if (shouldSkipUrl(normLink)) continue;
              if (!includeBlogs && /\/(blog|news|articles?|posts?)(\/|$)/i.test(normLink)) {
                continue;
              }
              if (isPathDisallowed(new URL(normLink).pathname, disallowPaths)) {
                continue;
              }

              seen.add(normLink);
              queue.push({ url: normLink, source: 'deep-crawl' });
            } catch {
              // skip invalid links
            }
          }
        }
      } catch (err) {
        pages.push({
          url,
          source,
          success: false,
          error: err instanceof Error ? err.message : 'Fetch failed',
        });
      }

      if (env.CRAWL_DELAY_MS > 0) {
        await delay(env.CRAWL_DELAY_MS);
      }
    }
  }

  const concurrency = Math.min(env.CRAWL_CONCURRENCY, maxPages);
  const runners = Array.from({ length: concurrency }, () => worker());
  await Promise.all(runners);

  for (const page of pages) {
    if (page.warnings?.length) {
      warnings.push(...page.warnings.map((w) => `${page.url}: ${w}`));
    }
  }

  const processed = pages.filter((p) => p.success).length;

  return {
    pages,
    stats: {
      discovered: queue.length,
      processed,
      failed: pages.length - processed,
      fetched: processed,
    },
    warnings,
  };
}
