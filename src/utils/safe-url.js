import dns from 'node:dns/promises';
import { URL } from 'node:url';
import { HttpError } from './http-error.js';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  'metadata.google.internal',
]);

const METADATA_HOST_PATTERNS = [
  /^169\.254\.169\.254$/,
  /^metadata\.google\.internal$/i,
];

/** @param {string} ip */
function parseIpv4(ip) {
  const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return null;
  }
  return parts;
}

/** @param {string} ip */
export function isBlockedIpAddress(ip) {
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) {
    return true;
  }

  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
      return true;
    }
    if (lower.startsWith('::ffff:')) {
      const mapped = lower.slice(7);
      if (mapped.includes('.')) {
        return isBlockedIpAddress(mapped);
      }
    }
    return false;
  }

  const parts = parseIpv4(ip);
  if (!parts) {
    return true;
  }

  const [a, b] = parts;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0 && parts[2] === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;

  for (const pattern of METADATA_HOST_PATTERNS) {
    if (pattern.test(ip)) return true;
  }

  return false;
}

/** @param {string} hostname */
export function isBlockedHostname(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host.endsWith('.internal')) return true;

  if (host === '127.0.0.1' || host.startsWith('127.')) return true;
  if (host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('169.254.')) {
    return true;
  }

  return false;
}

/**
 * @param {string} rawUrl
 * @returns {URL}
 */
export function parseHttpUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new HttpError(400, 'INVALID_URL', 'The provided URL is not valid.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HttpError(400, 'UNSUPPORTED_PROTOCOL', 'Only HTTP and HTTPS URLs are supported.');
  }

  if (!parsed.hostname) {
    throw new HttpError(400, 'INVALID_URL', 'The URL must include a hostname.');
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new HttpError(400, 'UNSAFE_URL', 'The URL points to a restricted or internal host.');
  }

  return parsed;
}

/**
 * Resolve hostname and reject if any address is in a blocked range.
 * @param {string} hostname
 */
export async function assertSafeHostname(hostname) {
  if (isBlockedHostname(hostname)) {
    throw new HttpError(400, 'UNSAFE_URL', 'The URL points to a restricted or internal host.');
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new HttpError(400, 'DNS_LOOKUP_FAILED', 'Could not resolve the hostname.');
  }

  if (!addresses.length) {
    throw new HttpError(400, 'DNS_LOOKUP_FAILED', 'Could not resolve the hostname.');
  }

  for (const entry of addresses) {
    if (isBlockedIpAddress(entry.address)) {
      throw new HttpError(400, 'UNSAFE_URL', 'The URL resolves to a restricted or internal address.');
    }
  }
}

/**
 * @param {string} rawUrl
 * @returns {Promise<URL>}
 */
export async function validateSafeUrl(rawUrl) {
  const parsed = parseHttpUrl(rawUrl);
  await assertSafeHostname(parsed.hostname);
  return parsed;
}

/**
 * Normalize URL for deduplication (remove fragment, trim trailing slash on path).
 * @param {string} rawUrl
 * @param {string} [baseOrigin]
 */
export function normalizeUrl(rawUrl, baseOrigin) {
  const parsed = baseOrigin ? new URL(rawUrl, baseOrigin) : new URL(rawUrl);
  parsed.hash = '';
  if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed.href;
}

/**
 * @param {string} urlA
 * @param {string} urlB
 */
export function isSameRegistrableDomain(urlA, urlB) {
  try {
    const a = new URL(urlA);
    const b = new URL(urlB);
    return a.hostname.toLowerCase() === b.hostname.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * @param {Array<{ url: string; source: string }>} entries
 * @param {string} [allowedHost]
 */
export function dedupeUrlEntries(entries, allowedHost) {
  const seen = new Set();
  const result = [];

  for (const entry of entries) {
    let normalized;
    try {
      normalized = normalizeUrl(entry.url);
      const host = new URL(normalized).hostname.toLowerCase();
      if (allowedHost && host !== allowedHost.toLowerCase()) {
        continue;
      }
    } catch {
      continue;
    }

    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push({ url: normalized, source: entry.source });
  }

  return result;
}
