import * as cheerio from 'cheerio';
import { detectJsHeavyPage, sanitizeMarkdownText, truncateText } from './llms-txt.utils.js';

const REMOVE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'svg',
  'iframe',
  'nav',
  'footer',
  '[role="navigation"]',
  '[role="contentinfo"]',
  '.cookie',
  '#cookie',
  '[class*="cookie"]',
  '[id*="cookie"]',
  '[aria-hidden="true"]',
  '.hidden',
];

/**
 * @param {cheerio.CheerioAPI} $
 * @param {cheerio.Element} root
 */
function extractReadableText($, root) {
  const clone = $(root).clone();
  clone.find(REMOVE_SELECTORS.join(',')).remove();
  const text = clone.text();
  return sanitizeMarkdownText(text);
}

/**
 * @param {string} html
 * @param {string} pageUrl
 */
export function extractPageContent(html, pageUrl) {
  const jsHeavy = detectJsHeavyPage(html);
  const $ = cheerio.load(html);

  $('script, style, noscript').remove();

  const title = sanitizeMarkdownText($('title').first().text());
  const metaDescription = sanitizeMarkdownText(
    $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      '',
  );
  const canonical =
    $('link[rel="canonical"]').attr('href') ||
    $('meta[property="og:url"]').attr('content') ||
    pageUrl;

  const h1 = sanitizeMarkdownText($('h1').first().text());
  const headings = [];
  $('h2, h3').each((_, el) => {
    const text = sanitizeMarkdownText($(el).text());
    if (text) headings.push({ level: el.tagName.toLowerCase(), text });
  });

  let mainText = '';
  const mainEl =
    $('main').first()[0] ||
    $('article').first()[0] ||
    $('[role="main"]').first()[0] ||
    $('.content, .main-content, #content, #main').first()[0];

  if (mainEl) {
    mainText = extractReadableText($, mainEl);
  } else {
    mainText = extractReadableText($, $('body')[0] || $.root()[0]);
  }

  const internalLinks = [];
  const origin = new URL(pageUrl).origin;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return;
    }
    try {
      const absolute = new URL(href, pageUrl).href;
      if (new URL(absolute).origin === origin) {
        internalLinks.push(absolute);
      }
    } catch {
      // skip
    }
  });

  const descriptionSource =
    metaDescription ||
    (h1 && mainText ? `${h1}. ${mainText}` : '') ||
    mainText ||
    h1 ||
    title ||
    '';

  const limitedContent = !descriptionSource && mainText.length < 20;

  const pageDescription = truncateText(descriptionSource, 220);

  return {
    url: pageUrl,
    canonical,
    title: title || h1 || new URL(pageUrl).pathname,
    metaDescription,
    h1,
    headings: headings.slice(0, 8),
    mainText: truncateText(mainText, 1200),
    internalLinks: [...new Set(internalLinks)].slice(0, 30),
    pageDescription,
    limitedContent,
    jsHeavy,
    warnings: [
      ...(jsHeavy ? ['Page may require JavaScript rendering; extracted content may be incomplete.'] : []),
      ...(limitedContent && !jsHeavy ? ['No metadata or body text could be extracted from this page.'] : []),
    ],
  };
}
