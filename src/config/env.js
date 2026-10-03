import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:3000'),
  MAX_PAGES: z.coerce.number().int().min(1).max(200).default(50),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(10000),
  MAX_RESPONSE_BYTES: z.coerce.number().int().min(10000).max(10000000).default(2000000),
  MAX_SITEMAP_BYTES: z.coerce.number().int().min(10000).max(20000000).default(5000000),
  MAX_REDIRECTS: z.coerce.number().int().min(0).max(10).default(5),
  CRAWL_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(3),
  CRAWL_DELAY_MS: z.coerce.number().int().min(0).max(5000).default(200),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(10),
  JSON_BODY_LIMIT: z.string().default('100kb'),
  USER_AGENT: z.string().min(1).default('URLTrim-LLMsTxtGenerator/1.0 (+https://www.urltrim.online)'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${message}`);
}

export const env = parsed.data;
