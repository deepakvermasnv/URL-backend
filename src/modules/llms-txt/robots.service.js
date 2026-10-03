import { safeFetchGet } from '../../utils/safe-fetch.js';

/**
 * Minimal robots.txt parser for Disallow rules (User-agent: * only).
 * @param {string} robotsText
 */
export function parseRobotsDisallow(robotsText) {
  const lines = robotsText.split('\n').map((l) => l.trim());
  let inGlobalAgent = false;
  const disallow = [];

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const [directive, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    const key = directive.toLowerCase();

    if (key === 'user-agent') {
      inGlobalAgent = value === '*';
      continue;
    }

    if (inGlobalAgent && key === 'disallow' && value) {
      disallow.push(value);
    }
  }

  return disallow;
}

/**
 * @param {string} path
 * @param {string[]} disallowPaths
 */
export function isPathDisallowed(path, disallowPaths) {
  for (const rule of disallowPaths) {
    if (rule === '/') return true;
    if (path.startsWith(rule)) return true;
  }
  return false;
}

/**
 * @param {string} origin
 * @returns {Promise<string[]>}
 */
export async function fetchRobotsDisallowRules(origin) {
  try {
    const robotsUrl = new URL('/robots.txt', origin).href;
    const response = await safeFetchGet(robotsUrl, { acceptHtml: false });
    if (!response.ok) return [];
    return parseRobotsDisallow(response.text);
  } catch {
    return [];
  }
}
