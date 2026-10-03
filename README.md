# URL Trim Shared Backend

Production-oriented, modular Node.js backend for [URL Trim](https://www.urltrim.online/) tools. The first implemented module is the **LLMs.txt Generator**. Additional tools can be added under `src/modules/` without changing the core architecture.

Frontend integration is planned as a separate phase. This repository contains backend code only.

## Technology stack

- Node.js 20+ (ES modules)
- Express.js
- Cheerio (HTML parsing)
- fast-xml-parser (sitemap XML)
- Zod (request validation)
- Helmet, CORS, express-rate-limit
- Vitest + Supertest (tests)
- ESLint

## Folder structure

```
shared-backend/
├── src/
│   ├── app.js                 # Express app factory
│   ├── server.js              # HTTP server entrypoint
│   ├── config/                # Environment and CORS
│   ├── routes/                # Versioned API router
│   ├── modules/
│   │   └── llms-txt/          # LLMs.txt generator module
│   ├── middleware/
│   └── utils/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── .env.example
├── render.yaml
└── package.json
```

Future modules should follow the same pattern:

1. Create `src/modules/<module-name>/` with routes, controller, service, and validators.
2. Register routes in `src/routes/index.js`.

## Requirements

- Node.js 20 or newer
- npm 9+

## Local installation

```bash
cd shared-backend
npm install
cp .env.example .env
```

## Environment setup

Copy `.env.example` to `.env` and adjust values as needed.

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP port | `5000` |
| `NODE_ENV` | `development`, `test`, or `production` | `development` |
| `FRONTEND_ORIGIN` | Allowed CORS origin(s), comma-separated | `http://localhost:3000` |
| `MAX_PAGES` | Max pages per generation job | `50` |
| `REQUEST_TIMEOUT_MS` | Per-request fetch timeout | `10000` |
| `MAX_RESPONSE_BYTES` | Max HTML response size | `2000000` |
| `MAX_SITEMAP_BYTES` | Max sitemap XML size | `5000000` |
| `MAX_REDIRECTS` | Max redirect hops per fetch | `5` |
| `CRAWL_CONCURRENCY` | Parallel page fetches | `3` |
| `CRAWL_DELAY_MS` | Delay between fetch batches | `200` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max generation requests per window | `10` |
| `JSON_BODY_LIMIT` | Express JSON body limit | `100kb` |
| `USER_AGENT` | Crawler User-Agent header | URLTrim identifier |

Environment variables are validated on startup via Zod.

## Running the server

```bash
# Development (with file watch)
npm run dev

# Production-style
npm start
```

Health check: `GET http://localhost:5000/api/v1/health`

## API endpoints (v1)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Service health |
| `POST` | `/api/v1/llms-txt/preview` | Analyze URLs and return structured page data (no file content) |
| `POST` | `/api/v1/llms-txt/generate` | Generate `llms.txt` content and metadata |
| `POST` | `/api/v1/llms-txt/download` | Same as generate, returned as a downloadable `text/plain` attachment |

Generation routes are rate-limited.

### Example request

```bash
curl -X POST http://localhost:5000/api/v1/llms-txt/generate \
  -H "Content-Type: application/json" \
  -d '{
    "websiteUrl": "https://example.com",
    "sitemapUrl": "https://example.com/sitemap.xml",
    "pageUrls": ["https://example.com/about"],
    "options": { "maxPages": 50, "includeBlogs": true }
  }'
```

### Example success response (generate)

```json
{
  "success": true,
  "data": {
    "filename": "example.com-llms.txt",
    "content": "# Example Website\n\n...",
    "website": { "origin": "https://example.com", "name": "Example Website" },
    "stats": { "discovered": 20, "processed": 18, "failed": 2, "fetched": 18 },
    "pages": [],
    "discoveredUrls": [],
    "warnings": [],
    "generatedAt": "2026-10-02T12:00:00.000Z"
  }
}
```

Preview responses omit `content` and `filename`.

### Input modes

- **Website URL** — discovers `/sitemap.xml` or `/sitemap_index.xml`, otherwise limited same-domain homepage links.
- **Sitemap URL** — parses urlset and sitemap index files.
- **Specific URLs** — validated HTTPS/HTTP URLs on the same domain as the site origin.
- **Combined** — all sources merged, deduplicated, with `source` preserved in `discoveredUrls`.

## Running tests

```bash
npm test
```

Tests use fixtures and mocked HTTP/DNS; they do not call live external websites.

## Security and SSRF limitations

User-supplied URLs are fetched server-side. Protections include:

- HTTP/HTTPS only
- Blocked localhost, metadata, private, link-local, and reserved IP ranges (hostname and resolved IP checks)
- DNS resolution before fetch
- Manual redirect handling with re-validation of each redirect target URL
- Response size, timeout, redirect, concurrency, and rate limits

**Limitations (important):**

- Node.js `fetch` connects after DNS lookup; a small time-of-check/time-of-use (TOCTOU) window remains between lookup and connection.
- DNS rebinding and advanced SSRF bypass techniques are not fully eliminated without a custom HTTP agent tied to resolved IPs (not implemented in v1).
- `robots.txt` is parsed in a minimal way (`User-agent: *` disallow rules only).
- JavaScript-rendered SPAs may return incomplete content; warnings are included instead of fabricated text.

## Render deployment

1. Create a new **Web Service** on [Render](https://render.com/).
2. Connect your GitHub repository containing `shared-backend`.
3. Settings:
   - **Root directory**: `shared-backend` (if the repo contains other folders)
   - **Build command**: `npm install`
   - **Start command**: `npm start`
   - **Health check path**: `/api/v1/health`
4. Set environment variables (at minimum):
   - `NODE_ENV=production`
   - `FRONTEND_ORIGIN=https://www.urltrim.online`
   - `PORT=5000` (Render often injects `PORT` automatically; the app reads `PORT`.)

See `render.yaml` for a starter Blueprint definition.

## GitHub repository setup

To host this backend separately:

```bash
cd shared-backend
git init
git add .
git commit -m "Initial shared backend with LLMs.txt module"
git branch -M main
git remote add origin https://github.com/<your-user>/urltrim-shared-backend.git
git push -u origin main
```

Do not commit `.env` files.

## Adding future modules

1. Add `src/modules/<name>/` with `*.routes.js`, controller, services, and validators.
2. Mount routes in `src/routes/index.js` (for example `router.use('/my-tool', myToolRoutes)`).
3. Add tests under `tests/unit` and `tests/integration`.
4. Document endpoints in this README.

Do not add empty placeholder modules until they are implemented.

## LLMs.txt generation behavior

- Deterministic, extractive output (no external LLM API).
- Descriptions come from extracted titles, meta descriptions, and main text.
- Pages with insufficient content are listed without invented summaries.
- Sections (`Important Pages`, `Main Tools / Services`, etc.) appear only when matching pages exist.

## Frontend integration (later phase)

Point the existing URL Trim frontend to this API base URL and call the v1 endpoints above. CORS is restricted to `FRONTEND_ORIGIN` (plus localhost in development).
