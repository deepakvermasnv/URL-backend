import { env } from '../config/env.js';
import { HttpError } from './http-error.js';
import { assertSafeHostname, parseHttpUrl, validateSafeUrl } from './safe-url.js';

const HTML_CONTENT_TYPES = ['text/html', 'application/xhtml+xml'];

/**
 * @param {string} contentType
 */
export function isHtmlContentType(contentType) {
  if (!contentType) return false;
  const base = contentType.split(';')[0].trim().toLowerCase();
  return HTML_CONTENT_TYPES.some((t) => base === t || base.startsWith(`${t};`));
}

/**
 * @param {string} contentType
 */
export function isAllowedFetchContentType(contentType) {
  if (!contentType) return true;
  const base = contentType.split(';')[0].trim().toLowerCase();
  if (base.startsWith('image/') || base.startsWith('video/') || base.startsWith('audio/')) {
    return false;
  }
  if (
    base === 'application/octet-stream' ||
    base === 'application/pdf' ||
    base === 'application/zip' ||
    base.startsWith('font/')
  ) {
    return false;
  }
  return true;
}

/**
 * @param {Response} response
 * @param {number} maxBytes
 */
export async function readResponseTextLimited(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) {
    return '';
  }

  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, 'RESPONSE_TOO_LARGE', 'The response exceeded the maximum allowed size.');
    }
    chunks.push(value);
  }

  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return buffer.toString('utf8');
}

/**
 * Safe HTTP GET with SSRF checks and manual redirect handling.
 * @param {string} rawUrl
 * @param {{ maxBytes?: number; timeoutMs?: number; acceptHtml?: boolean }} [options]
 */
export async function safeFetchGet(rawUrl, options = {}) {
  const maxBytes = options.maxBytes ?? env.MAX_RESPONSE_BYTES;
  const timeoutMs = options.timeoutMs ?? env.REQUEST_TIMEOUT_MS;
  let currentUrl = rawUrl;

  for (let redirectCount = 0; redirectCount <= env.MAX_REDIRECTS; redirectCount += 1) {
    await validateSafeUrl(currentUrl);
    const parsed = parseHttpUrl(currentUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(parsed.href, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': env.USER_AGENT,
          Accept: options.acceptHtml
            ? 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'
            : 'application/xml,text/xml,text/plain,*/*;q=0.8',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new HttpError(502, 'BAD_GATEWAY', 'Redirect response missing Location header.');
        }
        currentUrl = new URL(location, parsed.href).href;
        continue;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!isAllowedFetchContentType(contentType)) {
        throw new HttpError(415, 'UNSUPPORTED_CONTENT_TYPE', 'Unsupported content type for this resource.');
      }

      if (options.acceptHtml && contentType && !isHtmlContentType(contentType)) {
        throw new HttpError(415, 'UNSUPPORTED_CONTENT_TYPE', 'Expected an HTML page.');
      }

      const text = await readResponseTextLimited(response, maxBytes);

      return {
        url: parsed.href,
        finalUrl: parsed.href,
        status: response.status,
        contentType,
        text,
        ok: response.ok,
      };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new HttpError(504, 'TIMEOUT', 'The request timed out.');
      }
      throw new HttpError(502, 'FETCH_FAILED', 'Could not fetch the URL.');
    } finally {
      clearTimeout(timer);
    }
  }

  throw new HttpError(400, 'TOO_MANY_REDIRECTS', 'Too many redirects while fetching the URL.');
}

/**
 * Revalidate hostname after redirect (public API for tests).
 * @param {string} hostname
 */
export async function revalidateHostForRedirect(hostname) {
  await assertSafeHostname(hostname);
}
