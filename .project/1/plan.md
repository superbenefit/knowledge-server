# Plan: Package 0 — Shared Schemas & Types

**Issue**: #1
**Phase**: complete
**Started**: 2026-01-31

## Goal

Define all shared Zod schemas and TypeScript types used across the knowledge server modules. This package blocks all others — every module (auth, retrieval, API, sync, consumer, MCP) depends on these shared types.

## Approach

Create `src/types/` directory with one file per domain. All schemas use Zod v4 (4.3.6) with .openapi() annotations for REST API compatibility via @hono/zod-openapi (1.2.0, confirmed Zod v4 peer dep). Export inferred TypeScript types alongside every Zod schema. Barrel export everything from index.ts.

## Implementation Steps

### Phase 1: Content schemas
- [x] 1.1: Create src/types/content.ts — ContentType enum, BaseSchema, ArtifactSchema, TagSchema, ContentEntry, ContentMetadata
  - Files: src/types/content.ts
  - Depends: none

### Phase 2: Auth schemas
- [x] 2.1: Create src/types/auth.ts — AccessTier, HatsRole, AuthProps, HatsConfig constants
  - Files: src/types/auth.ts
  - Depends: none

### Phase 3: API schemas
- [x] 3.1: Create src/types/api.ts — SearchParams, ListParams, APIResponse, ErrorResponse, PaginatedResponse, SearchResult
  - Files: src/types/api.ts
  - Depends: 1.1 (references ContentEntry)

### Phase 4: Storage schemas
- [x] 4.1: Create src/types/storage.ts — R2Document, VectorizeRecordMetadata, KVNamespaces
  - Files: src/types/storage.ts
  - Depends: 1.1 (references content schemas)

### Phase 5: Sync schemas
- [x] 5.1: Create src/types/sync.ts — SyncParams, R2EventNotification, SyncStatus
  - Files: src/types/sync.ts
  - Depends: none

### Phase 6: MCP tool schemas
- [x] 6.1: Create src/types/mcp.ts — Tool input/output schemas for all 7 MCP tools
  - Files: src/types/mcp.ts
  - Depends: 1.1, 3.1 (references content and API schemas)

### Phase 7: Barrel export + validation
- [x] 7.1: Create src/types/index.ts — re-export all schemas and types
  - Files: src/types/index.ts
  - Depends: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1
- [x] 7.2: Run npm run type-check and fix any errors
  - Depends: 7.1
- [x] 7.3: Run /validate to check Cloudflare best practices
  - Depends: 7.2

## Current Step

Complete. PR #8 merged, issue #1 closed.

## Blockers

None.

## Validation

- [x] All schemas defined with Zod v4
- [x] npm run type-check passes
- [x] Schemas align with spec.md definitions
- [x] Types compatible with Cloudflare bindings (R2, Vectorize, KV)
- [x] /validate passes
