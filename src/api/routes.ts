import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
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
// App setup
// ---------------------------------------------------------------------------

export const api = new OpenAPIHono<{ Bindings: Env }>();

// Global error handler (spec section 10)
api.onError((err, c) => {
  console.error('API Error:', err);
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    500,
  );
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
  const { contentType, group, release, limit, offset } = c.req.valid('query');

  // Build R2 list prefix based on contentType filter
  const prefix = contentType ? `content/${contentType}/` : 'content/';

  // Collect all R2 object keys, handling truncated listings via cursor
  const allObjects: R2Object[] = [];
  let cursor: string | undefined;
  do {
    const listed = await c.env.KNOWLEDGE.list({
      prefix,
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    });
    allObjects.push(...listed.objects);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  // Batch-fetch documents in parallel
  const docs = await Promise.all(
    allObjects.map(async (obj): Promise<R2Document | null> => {
      const object = await c.env.KNOWLEDGE.get(obj.key);
      if (!object) return null;
      return object.json();
    }),
  );

  // Filter out nulls and apply optional metadata filters
  let entries = docs.filter((doc): doc is R2Document => {
    if (!doc) return false;
    if (group && doc.metadata?.group !== group) return false;
    if (release && doc.metadata?.release !== release) return false;
    return true;
  });

  const total = entries.length;

  // Apply pagination
  const paginated = entries.slice(offset, offset + limit);

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
