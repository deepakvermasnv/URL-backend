import { normalizeUrl } from '../../utils/safe-url.js';

const SKIP_PATH_PATTERNS = [
  /\/wp-admin/i,
  /\/admin(\/|$)/i,
  /\/login(\/|$)/i,
  /\/signin(\/|$)/i,
  /\/signup(\/|$)/i,
  /\/register(\/|$)/i,
  /\/cart(\/|$)/i,
  /\/checkout(\/|$)/i,
  /\/account(\/|$)/i,
  /\/search(\/|$|\?)/i,
  /\/tag\//i,
  /\/feed(\/|$)/i,
  /\/xmlrpc\.php/i,
  /[?&](utm_|fbclid|gclid|mc_eid)=/i,
];

const BINARY_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.ico',
  '.pdf',
  '.zip',
  '.mp4',
  '.mp3',
  '.woff',
  '.woff2',
  '.css',
  '.js',
  '.json',
]);

/**
 * @param {string} url
 */
export function shouldSkipUrl(url) {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}`.toLowerCase();
    const ext = parsed.pathname.includes('.')
      ? parsed.pathname.slice(parsed.pathname.lastIndexOf('.')).toLowerCase()
      : '';

    if (BINARY_EXTENSIONS.has(ext)) return true;
    return SKIP_PATH_PATTERNS.some((re) => re.test(path));
  } catch {
    return true;
  }
}

/**
 * @param {string} text
 */
export function sanitizeMarkdownText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    // eslint-disable-next-line no-control-regex -- strip control characters from untrusted HTML text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} text
 * @param {number} maxLen
 */
export function truncateText(text, maxLen = 240) {
  const clean = sanitizeMarkdownText(text);
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trim()}…`;
}

/**
 * @param {string} hostname
 */
export function suggestFilename(hostname) {
  const safe = hostname.replace(/[^a-zA-Z0-9.-]/g, '-');
  return `${safe || 'website'}-llms.txt`;
}

/**
 * Universal classification algorithm for ANY website on the internet
 * @param {string} url
 * @param {string} siteOrigin
 */
export function classifyPageSection(url, siteOrigin) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase().replace(/\/$/, '');
    const origin = parsed.origin.toLowerCase();
    const cleanOrigin = new URL(siteOrigin).origin.toLowerCase();

    // 1. Homepage
    if (path === '' || path === '/') {
      return 'important';
    }

    // 2. Core Important Pages (About, Contact, Support, Docs, Pricing, Features, FAQ)
    if (
      /^\/(about|about-us|company|contact|contact-us|pricing|plans|faq|faqs|help|support|start|get-started|getting-started|setup|quickstart|docs|documentation|overview|features|team|careers|jobs)(\/|$)/.test(
        path
      )
    ) {
      return 'important';
    }

    // 3. Official / Legal / Trust Pages
    if (
      /^\/(privacy|privacy-policy|terms|terms-of-service|terms-and-conditions|legal|disclaimer|cookie-policy|security|trust|imprint|licenses|compliance|security-policy)(\/|$)/.test(
        path
      )
    ) {
      return 'official';
    }

    // 4. Products, E-Commerce Items, Software Tools, Solutions, Services
    if (
      /^\/(tool|tools|product|products|service|services|solution|solutions|feature|features|app|apps|shop|store|catalog|catalogue|category|categories|collection|collections|item|items|pricing)(\/|$)/.test(
        path
      ) ||
      /-(tool|tools|plugin|extension|generator|converter|calculator|service|services|agency|solution|solutions|app)$/.test(
        path
      )
    ) {
      return 'products';
    }

    // 5. Guides, Blogs, Articles, Tutorials, Resources, Case Studies, News
    if (
      /^\/(blog|blogs|news|article|articles|post|posts|resource|resources|guide|guides|tutorial|tutorials|case-study|case-studies|learn|kb|knowledge-base|changelog|updates|insights)(\/|$)/.test(
        path
      ) ||
      /\/\d{4}\/\d{2}\//.test(path) ||
      /^(how-to|what-is|what-are|why-|tips|guide|tutorial|strategy|insights|complete-guide|ultimate-guide|top-|best-|vs-|-vs-|-guide|-tips|-tutorial|-strategy|-checklist|-template|-example|-examples)/.test(
        path.split('/').pop() || ''
      )
    ) {
      return 'guides';
    }

    // 6. Generic single-segment slug classification for custom sites
    const segments = path.split('/').filter(Boolean);
    if (origin === cleanOrigin && segments.length === 1) {
      const slug = segments[0];
      // If single segment slug looks like an article/guide title (has multiple hyphens like /how-to-do-something)
      if ((slug.match(/-/g) || []).length >= 2) {
        return 'guides';
      }
      return 'important';
    }

    return 'optional';
  } catch {
    return 'optional';
  }
}

/**
 * @param {string} html
 */
export function detectJsHeavyPage(html) {
  const lower = html.toLowerCase();
  const hasRootMount =
    lower.includes('id="root"') ||
    lower.includes("id='root'") ||
    lower.includes('id="__next"') ||
    lower.includes('ng-app') ||
    lower.includes('data-reactroot');

  const scriptCount = (lower.match(/<script/g) || []).length;
  const bodyMatch = lower.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  const bodyText = bodyMatch ? bodyMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const shortBody = bodyText.length < 120;

  return hasRootMount && scriptCount >= 3 && shortBody;
}

/**
 * @param {string[]} urls
 * @param {string} origin
 */
export function normalizeAndFilterSameOrigin(urls, origin) {
  const host = new URL(origin).hostname.toLowerCase();
  const result = [];

  for (const raw of urls) {
    try {
      const normalized = normalizeUrl(raw, origin);
      const u = new URL(normalized);
      if (u.hostname.toLowerCase() !== host) continue;
      if (shouldSkipUrl(normalized)) continue;
      result.push(normalized);
    } catch {
      // skip invalid
    }
  }

  return [...new Set(result)];
}
