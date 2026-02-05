import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { toR2Key } from '../types/storage';
import type { R2Document } from '../types/storage';
import type { ContentType } from '../types/content';
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

  const listed = await c.env.KNOWLEDGE.list({ prefix, limit: 1000 });

  // Fetch documents and apply filters
  let entries: R2Document[] = [];

  for (const obj of listed.objects) {
    const object = await c.env.KNOWLEDGE.get(obj.key);
    if (!object) continue;

    const doc: R2Document = await object.json();

    // Apply optional filters
    if (group && doc.metadata?.group !== group) continue;
    if (release && doc.metadata?.release !== release) continue;

    entries.push(doc);
  }

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

  const key = toR2Key(contentType as ContentType, id);
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
  // TODO: Wire up retrieval module (Package 2) when available.
  // For now return empty results to satisfy the route contract.
  const _params = c.req.valid('query');

  return c.json({ results: [] }, 200, CACHE_HEADERS);
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
