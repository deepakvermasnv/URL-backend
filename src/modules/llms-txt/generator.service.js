import { classifyPageSection, sanitizeMarkdownText, suggestFilename } from './llms-txt.utils.js';

/**
 * @param {string} text
 */
function escapeMarkdownInline(text) {
  return text.replace(/[\\`*_[\]]/g, '\\$&');
}

/**
 * @param {string} label
 * @param {string} url
 * @param {string} [description]
 */
/**
 * @param {Array<Record<string, unknown>>} pages
 */
function extractUseCases(pages) {
  const useCases = [];
  const seen = new Set();

  for (const page of pages) {
    const desc = String(page.pageDescription || page.metaDescription || '');
    if (!desc || desc.length < 15) continue;

    const sentences = desc.split(/(?<=[.!?])\s+/);
    for (const s of sentences) {
      const clean = sanitizeMarkdownText(s);
      if (clean.length >= 20 && clean.length <= 140) {
        const key = clean.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          useCases.push(`- ${clean}`);
          if (useCases.length >= 6) break;
        }
      }
    }
    if (useCases.length >= 6) break;
  }

  return useCases;
}

/**
 * @param {string} label
 * @param {string} url
 * @param {string} [description]
 */
function formatLinkLine(label, url, description) {
  const safeLabel = escapeMarkdownInline(sanitizeMarkdownText(label) || url);
  const desc = sanitizeMarkdownText(description || '');
  if (!desc) {
    return `- [${safeLabel}](${url})`;
  }
  return `- [${safeLabel}](${url}): ${desc}`;
}

/**
 * @param {Array<Record<string, unknown>>} successfulPages
 * @param {{ siteName?: string; siteOrigin: string; siteTagline?: string }} meta
 */
export function generateLlmsTxt(successfulPages, meta) {
  const siteName = sanitizeMarkdownText(meta.siteName || new URL(meta.siteOrigin).hostname);
  const sections = {
    products: [],
    important: [],
    guides: [],
    official: [],
    optional: [],
  };

  const seenUrls = new Set();

  for (const page of successfulPages) {
    const url = String(page.canonical || page.url);
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    const title = sanitizeMarkdownText(String(page.metaTitle || page.h1 || page.title || url));
    const description = page.limitedContent
      ? ''
      : sanitizeMarkdownText(String(page.metaDescription || page.pageDescription || ''));
    const line = formatLinkLine(title, url, description);
    const section = classifyPageSection(url, meta.siteOrigin);
    if (sections[section]) {
      sections[section].push(line);
    } else {
      sections.optional.push(line);
    }
  }

  const lines = [`# ${siteName}`, ''];

  const tagline = sanitizeMarkdownText(meta.siteTagline || '');
  if (tagline) {
    lines.push(`> ${tagline}`, '');
  }

  lines.push('Key facts:');
  lines.push(`- Site: ${meta.siteOrigin}`);
  lines.push(`- Index Pages: ${successfulPages.length}`);
  lines.push('');

  const sectionTitles = {
    products: 'Main Products / Services / Tools',
    important: 'Important Pages',
    guides: 'Blog & Articles',
    official: 'Official & Authoritative Pages',
    optional: 'Optional & Secondary Resources',
  };

  for (const key of ['products', 'important', 'guides', 'official', 'optional']) {
    if (sections[key].length === 0) continue;
    lines.push(`## ${sectionTitles[key]}`, '');
    lines.push(...sections[key], '');
  }

  const useCases = extractUseCases(successfulPages);
  if (useCases.length > 0) {
    lines.push('## Common Use Cases', '');
    lines.push(...useCases, '');
  }

  return lines.join('\n').trim() + '\n';
}

/**
 * @param {Array<Record<string, unknown>>} pages
 * @param {string} siteOrigin
 */
export function buildWebsiteMeta(pages, siteOrigin) {
  const homepage =
    pages.find((p) => {
      try {
        const path = new URL(String(p.url)).pathname;
        return path === '/' || path === '';
      } catch {
        return false;
      }
    }) || pages[0];

  const siteName = homepage?.title || homepage?.h1 || new URL(siteOrigin).hostname;
  let siteTagline = homepage?.metaDescription || '';

  if (!siteTagline && homepage?.mainText) {
    siteTagline = String(homepage.mainText).slice(0, 200);
  }

  return {
    siteName: sanitizeMarkdownText(String(siteName)),
    siteOrigin,
    siteTagline: sanitizeMarkdownText(siteTagline),
    filename: suggestFilename(new URL(siteOrigin).hostname),
  };
}
