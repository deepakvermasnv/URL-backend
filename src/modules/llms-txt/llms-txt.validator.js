import { z } from 'zod';
import { env } from '../../config/env.js';

const optionalUrl = z
  .string()
  .url()
  .optional()
  .or(z.literal('').transform(() => undefined));

export const llmsTxtRequestSchema = z.object({
  websiteUrl: optionalUrl,
  sitemapUrl: optionalUrl,
  pageUrls: z.array(z.string().url()).max(env.MAX_PAGES).optional().default([]),
  options: z
    .object({
      maxPages: z.coerce.number().int().min(1).max(env.MAX_PAGES).optional(),
      includeBlogs: z.boolean().optional().default(true),
    })
    .optional()
    .default({}),
});

/**
 * @param {unknown} body
 */
export function parseLlmsTxtRequest(body) {
  const parsed = llmsTxtRequestSchema.parse(body);

  if (!parsed.websiteUrl && !parsed.sitemapUrl && parsed.pageUrls.length === 0) {
    throw new z.ZodError([
      {
        code: 'custom',
        message: 'Provide at least one of websiteUrl, sitemapUrl, or pageUrls.',
        path: ['websiteUrl'],
      },
    ]);
  }

  const maxPages = Math.min(parsed.options.maxPages ?? env.MAX_PAGES, env.MAX_PAGES);

  return {
    ...parsed,
    options: {
      ...parsed.options,
      maxPages,
    },
  };
}
