# Plan: Package 0 — Shared Schemas & Types

**Issue**: #1
**Phase**: complete
**Started**: 2026-01-31
**Redone**: 2026-02-03

## Goal

Define all shared Zod schemas and TypeScript types used across the knowledge server modules. This package blocks all others — every module (auth, retrieval, API, sync, consumer, MCP) depends on these shared types.

## Approach

Create `src/types/` with four domain files per plan v2.6: content.ts, auth.ts, api.ts, storage.ts. Sync and MCP tool schemas are deferred to their respective packages (Package 4 and Integration). All schemas use Zod v4 with .openapi() annotations. Barrel export from index.ts.

## Implementation Steps

### Phase 1: Content schemas
- [x] 1.1: Create src/types/content.ts — 20-type ContentTypeSchema, PATH_TYPE_MAP, inferContentType, FileSchema base, parent schemas, 16 concrete type schemas, ContentSchema discriminated union
  - Files: src/types/content.ts

### Phase 2: Auth schemas
- [x] 2.1: Create src/types/auth.ts — AccessTier, HatsRole, AuthProps, HATS_CONFIG, TIER_TOOLS
  - Files: src/types/auth.ts

### Phase 3: API schemas
- [x] 3.1: Create src/types/api.ts — SearchFilters, ListParams, SearchParams, SearchResult, RerankResult, ErrorResponse, EntryResponse, EntryListResponse, SearchResponse
  - Files: src/types/api.ts

### Phase 4: Storage schemas
- [x] 4.1: Create src/types/storage.ts — R2Document, VectorizeMetadata, VECTORIZE_LIMITS, truncateForMetadata, generateId, toR2Key, extractIdFromKey, extractContentTypeFromKey
  - Files: src/types/storage.ts

### Phase 5: Barrel export + validation
- [x] 5.1: Create src/types/index.ts — re-export content, auth, api, storage only
  - Files: src/types/index.ts
- [x] 5.2: Run npm run type-check — zero errors
- [x] 5.3: Run /validate — types pass, index.ts legacy issues acknowledged

## Scope Changes (v0.11 redo)

- Removed src/types/sync.ts — deferred to Package 4 (Sync Workflow)
- Removed src/types/mcp.ts — deferred to Integration phase
- Moved SearchFiltersSchema from mcp.ts to api.ts
- Added RerankResultSchema to api.ts (was missing)

## Blockers

None.

## Validation

- [x] All schemas defined with Zod v4
- [x] npm run type-check passes
- [x] Schemas align with spec v0.11
- [x] Types compatible with Cloudflare bindings (R2, Vectorize, KV)
- [x] /validate passes for types (index.ts legacy template issues are out of scope)
