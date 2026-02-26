import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { toR2Key } from '../types/storage';
import type { R2Document } from '../types/storage';
import { searchKnowledge } from '../retrieval';
import {
  EntryParamsSchema,
  ListQuerySchema,
  SearchQuerySchema,
  EntryListResponseSchema,
  EntryResponseSchema,
  SearchResponseSchema,
  ErrorResponseSchema,
} from './schemas';

// ---------------------------------------------------------------------------
// R2 listing helper
// ---------------------------------------------------------------------------

async function listR2Objects(bucket: R2Bucket, prefix: string, maxKeys: number): Promise<R2Object[]> {
  const objects: R2Object[] = [];
  let cursor: string | undefined;
  do {
    const listed = await bucket.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
    objects.push(...listed.objects);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor && objects.length < maxKeys);
  return objects;
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

export const api = new OpenAPIHono<{ Bindings: Env }>();

// Global error handler (spec section 10)
api.onError((err, c) => {
  // Security: Log sanitized error (no stack traces or sensitive data)
  console.error('API Error:', err instanceof Error ? err.message : 'Unknown error');
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    500,
  );
});

// Security headers middleware
api.use('*', async (c, next) => {
  await next();
  // Docs page needs a permissive CSP for Scalar CDN — handled by route-specific middleware
  if (!c.req.path.endsWith('/docs')) {
    c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  }
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

// CORS middleware — public read-only API
api.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'HEAD', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Accept'],
    maxAge: 86400,
  }),
);

// Cache headers applied to all GET responses
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
} as const;

// ---------------------------------------------------------------------------
// GET /health — health check
// ---------------------------------------------------------------------------

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ status: z.string() }) } },
      description: 'Health check',
    },
  },
});

api.openapi(healthRoute, async (c) => {
  return c.json({ status: 'ok' }, 200);
});

// ---------------------------------------------------------------------------
// GET /entries — list/filter entries
// ---------------------------------------------------------------------------

const listEntriesRoute = createRoute({
  method: 'get',
  path: '/entries',
  request: {
    query: ListQuerySchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: EntryListResponseSchema } },
      description: 'Paginated list of entries',
    },
  },
});

api.openapi(listEntriesRoute, async (c) => {
  const { contentType, group, release, sourcePath, limit, offset } = c.req.valid('query');

  // Collect R2 object keys with cursor pagination.
  // Cap at a reasonable maximum to prevent OOM on huge buckets.
  const maxKeys = 10000;

  // Determine which prefixes to list based on contentType filter:
  // - index → indexes/ only
  // - specific non-index type → content/{type}/ only
  // - no filter → both content/ and indexes/
  const allObjects: R2Object[] = [];
  if (contentType === 'index') {
    const objs = await listR2Objects(c.env.KNOWLEDGE, 'indexes/', maxKeys);
    allObjects.push(...objs);
  } else if (contentType) {
    const objs = await listR2Objects(c.env.KNOWLEDGE, `content/${contentType}/`, maxKeys);
    allObjects.push(...objs);
  } else {
    const [contentObjs, indexObjs] = await Promise.all([
      listR2Objects(c.env.KNOWLEDGE, 'content/', maxKeys),
      listR2Objects(c.env.KNOWLEDGE, 'indexes/', maxKeys),
    ]);
    allObjects.push(...contentObjs, ...indexObjs);
  }

  // If group/release filters are active, we must fetch metadata to filter.
  // Otherwise, we can determine total from keys and only fetch the page.
  let paginated: R2Document[];
  let total: number;

  if (group || release || sourcePath) {
    // Need metadata to filter — fetch in batches of 50 to limit concurrency
    const BATCH_SIZE = 50;
    const allDocs: R2Document[] = [];
    for (let i = 0; i < allObjects.length; i += BATCH_SIZE) {
      const batch = allObjects.slice(i, i + BATCH_SIZE);
      const batchDocs = await Promise.all(
        batch.map(async (obj): Promise<R2Document | null> => {
          const object = await c.env.KNOWLEDGE.get(obj.key);
          if (!object) return null;
          return object.json();
        }),
      );
      for (const doc of batchDocs) {
        if (!doc) continue;
        if (group && doc.metadata?.group !== group) continue;
        if (release && doc.metadata?.release !== release) continue;
        if (sourcePath && !doc.path.startsWith(sourcePath)) continue;
        allDocs.push(doc);
      }
    }
    total = allDocs.length;
    paginated = allDocs.slice(offset, offset + limit);
  } else {
    // No metadata filters — only fetch the paginated slice of documents
    total = allObjects.length;
    const pageObjects = allObjects.slice(offset, offset + limit);
    const BATCH_SIZE = 50;
    paginated = [];
    for (let i = 0; i < pageObjects.length; i += BATCH_SIZE) {
      const batch = pageObjects.slice(i, i + BATCH_SIZE);
      const batchDocs = await Promise.all(
        batch.map(async (obj): Promise<R2Document | null> => {
          const object = await c.env.KNOWLEDGE.get(obj.key);
          if (!object) return null;
          return object.json();
        }),
      );
      for (const doc of batchDocs) {
        if (doc) paginated.push(doc);
      }
    }
  }

  return c.json(
    { data: paginated, total, offset, limit },
    200,
    CACHE_HEADERS,
  );
});

// ---------------------------------------------------------------------------
// GET /entries/{contentType}/{id} — single entry
// ---------------------------------------------------------------------------

const getEntryRoute = createRoute({
  method: 'get',
  path: '/entries/{contentType}/{id}',
  request: {
    params: EntryParamsSchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: EntryResponseSchema } },
      description: 'Full document',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Entry not found',
    },
  },
});

api.openapi(getEntryRoute, async (c) => {
  const { contentType, id } = c.req.valid('param');

  const key = toR2Key(contentType, id);
  const object = await c.env.KNOWLEDGE.get(key);

  if (!object) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: `Entry ${contentType}/${id} not found` } },
      404,
    );
  }

  const doc: R2Document = await object.json();
  return c.json({ data: doc }, 200, CACHE_HEADERS);
});

// ---------------------------------------------------------------------------
// GET /search — semantic search (stubbed)
// ---------------------------------------------------------------------------

const searchRoute = createRoute({
  method: 'get',
  path: '/search',
  request: {
    query: SearchQuerySchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SearchResponseSchema } },
      description: 'Search results',
    },
  },
});

api.openapi(searchRoute, async (c) => {
  const { q, contentType, group, release, limit } = c.req.valid('query');

  const results = await searchKnowledge(
    q,
    { contentType, group, release },
    {},
    c.env,
  );

  // Apply limit to results (Vectorize already limits to 20, this allows smaller sets)
  const limitedResults = results.slice(0, limit);

  return c.json({ results: limitedResults }, 200, CACHE_HEADERS);
});

// ---------------------------------------------------------------------------
// GET /openapi.json — auto-generated OpenAPI spec
// ---------------------------------------------------------------------------

api.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'SuperBenefit Knowledge API',
    version: '0.1.0',
    description: 'Public read-only API for the SuperBenefit knowledge base',
  },
});

// ---------------------------------------------------------------------------
// GET /docs — Scalar API docs UI
// ---------------------------------------------------------------------------

// Override strict CSP for the docs page (Scalar loads from CDN)
api.use('/docs', async (c, next) => {
  await next();
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; connect-src 'self'; img-src 'self' data: https://cdn.jsdelivr.net;",
  );
});

api.get('/docs', Scalar({ url: '/api/v1/openapi.json', pageTitle: 'SuperBenefit Knowledge API' }));
