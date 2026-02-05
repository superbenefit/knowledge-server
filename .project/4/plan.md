# Package 3: REST API Routes — Implementation Plan

## Scope

Implement public REST API routes using Hono + @hono/zod-openapi per spec v0.11 section 8.

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/api/routes.ts` | Create | OpenAPIHono app with CORS, all route definitions and handlers |
| `src/api/schemas.ts` | Create | Zod OpenAPI route schemas (re-exports + route-level schemas) |
| `src/index.ts` | Modify | Mount `/api/v1` sub-router |

## Endpoints

1. **GET /entries** — List/filter entries from R2 with pagination
2. **GET /entries/{contentType}/{id}** — Get single entry by contentType + id
3. **GET /search** — Semantic search (stubbed until retrieval module lands)
4. **GET /openapi.json** — Auto-generated OpenAPI spec

## Design Decisions

- Use `OpenAPIHono` from `@hono/zod-openapi` for route definitions
- CORS middleware: `origin: '*'`, methods `GET/HEAD/OPTIONS`, `maxAge: 86400`
- Cache headers: `max-age=300, stale-while-revalidate=3600`
- Search handler is stubbed — returns empty results with a message
- Entry listing uses R2 `list()` with prefix filtering
- Single entry uses R2 `get()` with `toR2Key()` helper

## Dependencies

- Package 0 (types) — merged ✅
- Package 2 (retrieval) — interface only, stubbed in search handler
