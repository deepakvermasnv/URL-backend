import { XMLParser } from 'fast-xml-parser';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import { safeFetchGet } from '../../utils/safe-fetch.js';
import { normalizeUrl } from '../../utils/safe-url.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
});

/**
 * @param {unknown} node
 * @returns {string[]}
 */
function extractLocValues(node) {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) {
    return node.flatMap(extractLocValues);
  }
  if (typeof node === 'object' && node !== null && 'loc' in node) {
    return extractLocValues(node.loc);
  }
  return [];
}

/**
 * @param {string} xml
 * @returns {{ type: 'index' | 'urlset'; urls: string[] }}
 */
export function parseSitemapXml(xml) {
  let parsed;
  try {
    parsed = parser.parse(xml);
  } catch {
    throw new HttpError(400, 'INVALID_SITEMAP', 'The sitemap XML could not be parsed.');
  }

  if (parsed.sitemapindex) {
    const entries = parsed.sitemapindex.sitemap;
    const urls = extractLocValues(entries);
    return { type: 'index', urls };
  }

  if (parsed.urlset) {
    const entries = parsed.urlset.url;
    const urls = extractLocValues(entries);
    return { type: 'urlset', urls };
  }

  throw new HttpError(400, 'INVALID_SITEMAP', 'Unsupported or empty sitemap format.');
}

/**
 * @param {string} sitemapUrl
 * @param {number} [maxUrls]
 * @returns {Promise<{ urls: string[]; warnings: string[] }>}
 */
export async function fetchSitemapUrls(sitemapUrl, maxUrls = env.MAX_PAGES * 4) {
  const warnings = [];
  const collected = [];

  /** @param {string} url @param {number} depth */
  async function loadSitemap(url, depth) {
    if (collected.length >= maxUrls || depth > 5) return;

    let response;
    try {
      response = await safeFetchGet(url, {
        maxBytes: env.MAX_SITEMAP_BYTES,
        acceptHtml: false,
      });
    } catch {
      warnings.push(`Could not fetch sitemap: ${url}`);
      return;
    }

    if (!response.ok) {
      warnings.push(`Sitemap returned HTTP ${response.status}: ${url}`);
      return;
    }

    let parsed;
    try {
      parsed = parseSitemapXml(response.text);
    } catch {
      warnings.push(`Invalid sitemap at ${url}`);
      return;
    }

    if (parsed.type === 'index') {
      for (const childUrl of parsed.urls) {
        if (collected.length >= maxUrls) break;
        try {
          const normalized = normalizeUrl(childUrl);
          await loadSitemap(normalized, depth + 1);
        } catch {
          warnings.push(`Skipped invalid sitemap entry: ${childUrl}`);
        }
      }
      return;
    }

    for (const pageUrl of parsed.urls) {
      if (collected.length >= maxUrls) break;
      try {
        collected.push(normalizeUrl(pageUrl));
      } catch {
        warnings.push(`Skipped invalid URL in sitemap: ${pageUrl}`);
      }
    }
  }

  await loadSitemap(sitemapUrl, 0);

  return {
    urls: [...new Set(collected)],
    warnings,
  };
}

/**
 * @param {string} websiteOrigin
 * @returns {Promise<{ urls: string[]; warnings: string[]; found: boolean }>}
 */
export async function discoverDefaultSitemaps(websiteOrigin) {
  const candidates = ['/sitemap.xml', '/sitemap_index.xml'].map((path) =>
    normalizeUrl(path, websiteOrigin),
  );

  const warnings = [];
  for (const candidate of candidates) {
    try {
      const result = await fetchSitemapUrls(candidate);
      if (result.urls.length > 0) {
        return { urls: result.urls, warnings: result.warnings, found: true };
      }
      warnings.push(...result.warnings);
    } catch {
      // try next candidate
    }
  }

  return { urls: [], warnings, found: false };
}
