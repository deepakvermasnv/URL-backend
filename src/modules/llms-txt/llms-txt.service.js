import { HttpError } from '../../utils/http-error.js';
import { dedupeUrlEntries, normalizeUrl, validateSafeUrl } from '../../utils/safe-url.js';
import { crawlPages, discoverHomepageLinks } from './crawler.service.js';
import { buildWebsiteMeta, generateLlmsTxt } from './generator.service.js';
import { normalizeAndFilterSameOrigin, shouldSkipUrl } from './llms-txt.utils.js';
import { fetchRobotsDisallowRules } from './robots.service.js';
import { discoverDefaultSitemaps, fetchSitemapUrls } from './sitemap.service.js';

/**
 * @param {ReturnType<import('./llms-txt.validator.js').parseLlmsTxtRequest>} input
 * @param {{ preview?: boolean }} [runOptions]
 */
export async function runLlmsTxtJob(input, runOptions = {}) {
  const warnings = [];
  const urlEntries = [];

  let siteOrigin = input.websiteUrl ? normalizeUrl(input.websiteUrl) : null;

  if (input.websiteUrl) {
    await validateSafeUrl(input.websiteUrl);
    siteOrigin = new URL(input.websiteUrl).origin;
    urlEntries.push({ url: normalizeUrl(input.websiteUrl), source: 'website' });
  }

  if (input.sitemapUrl) {
    await validateSafeUrl(input.sitemapUrl);
    const sitemapOrigin = normalizeUrl(input.sitemapUrl);
    if (!siteOrigin) {
      siteOrigin = new URL(sitemapOrigin).origin;
    }
    urlEntries.push({ url: normalizeUrl(siteOrigin), source: 'homepage' });

    try {
      const sitemapResult = await fetchSitemapUrls(input.sitemapUrl);
      warnings.push(...sitemapResult.warnings);
      for (const url of sitemapResult.urls) {
        urlEntries.push({ url, source: 'sitemap' });
      }
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : 'Sitemap could not be processed.');
    }
  }

  if (input.websiteUrl && !input.sitemapUrl) {
    const discovery = await discoverDefaultSitemaps(siteOrigin);
    warnings.push(...discovery.warnings);
    if (discovery.found) {
      for (const url of discovery.urls) {
        urlEntries.push({ url, source: 'sitemap-auto' });
      }
    } else {
      try {
        const homepageLinks = await discoverHomepageLinks(siteOrigin, 25);
        for (const url of homepageLinks) {
          urlEntries.push({ url, source: 'homepage-links' });
        }
        if (homepageLinks.length <= 1) {
          warnings.push('No sitemap found; only limited homepage link discovery was used.');
        }
      } catch {
        warnings.push('Could not discover additional links from the homepage.');
      }
    }
  }

  for (const pageUrl of input.pageUrls || []) {
    await validateSafeUrl(pageUrl);
    urlEntries.push({ url: normalizeUrl(pageUrl), source: 'manual' });
  }

  if (!siteOrigin) {
    if (urlEntries.length === 0) {
      throw new HttpError(400, 'INVALID_INPUT', 'No valid URLs to process.');
    }
    siteOrigin = new URL(urlEntries[0].url).origin;
  }

  const allowedHost = new URL(siteOrigin).hostname.toLowerCase();
  let deduped = dedupeUrlEntries(urlEntries, allowedHost);

  deduped = deduped.filter((entry) => {
    if (shouldSkipUrl(entry.url)) {
      warnings.push(`Skipped URL by crawl rules: ${entry.url}`);
      return false;
    }
    if (!input.options.includeBlogs && /\/(blog|news|articles?|posts?)(\/|$)/i.test(entry.url)) {
      return false;
    }
    return true;
  });

  if (deduped.length === 0) {
    throw new HttpError(400, 'NO_URLS', 'No crawlable URLs remained after validation.');
  }

  if (deduped.length > input.options.maxPages) {
    warnings.push(`URL list truncated to ${input.options.maxPages} pages (server limit).`);
    deduped = deduped.slice(0, input.options.maxPages);
  }

  const disallowPaths = await fetchRobotsDisallowRules(siteOrigin);
  if (disallowPaths.length > 0) {
    warnings.push('robots.txt disallow rules are applied where parseable (User-agent: *).');
  }

  const crawlResult = await crawlPages(deduped, {
    maxPages: input.options.maxPages,
    disallowPaths,
    allowedHost,
    includeBlogs: input.options.includeBlogs,
    deepCrawl: input.options.deepCrawl,
  });

  warnings.push(...crawlResult.warnings);

  const successfulPages = crawlResult.pages.filter((p) => p.success);
  const meta = buildWebsiteMeta(successfulPages, siteOrigin);

  const discoveredUrls = crawlResult.pages.map((d) => ({ url: d.url, source: d.source }));

  const baseResponse = {
    website: {
      origin: siteOrigin,
      name: meta.siteName,
    },
    stats: crawlResult.stats,
    pages: crawlResult.pages,
    discoveredUrls,
    warnings,
    generatedAt: new Date().toISOString(),
  };

  if (runOptions.preview) {
    return baseResponse;
  }

  const content = generateLlmsTxt(successfulPages, meta);

  return {
    ...baseResponse,
    filename: meta.filename,
    content,
  };
}

/**
 * @param {string} origin
 * @param {string[]} urls
 */
export function filterSameOriginUrls(origin, urls) {
  return normalizeAndFilterSameOrigin(urls, origin);
}
