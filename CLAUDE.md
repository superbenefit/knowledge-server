# Knowledge Server - SuperBenefit MCP

## Project Context

Building an MCP server + public REST API for SuperBenefit DAO that:
- Serves knowledge base search tools via MCP
- Exposes read-only REST API for web/external access
- Syncs from GitHub to R2 to Vectorize
- Uses porch access control framework (Phase 1: Open tier, no auth)

**Phase 1 (current):** All tools are Open tier — no authentication required.
**Phase 2 (future):** Add Public tier via Cloudflare Access for SaaS.
**Phase 3 (future):** Add Members tier via Hats Protocol / token gate.

## Technical Stack

- Cloudflare Workers (stateless `createMcpHandler`)
- Hono for HTTP routing + REST API
- @hono/zod-openapi for OpenAPI generation
- Vectorize for semantic search
- R2 for content storage
- Queues for event-driven indexing
- `@superbenefit/porch` (local `file:../mcporch`) for shared auth, security headers

## Code Standards

### Strict Requirements

- Always use `export default { fetch }` pattern or Hono app export
- NEVER use `addEventListener('fetch', ...)`
- Use Web standard APIs (Request, Response, URL)
- Import Cloudflare types from 'cloudflare:workers'
- Environment accessed via second arg: `fetch(req, env)`

### MCP Server Pattern (Porch Framework)

- Use stateless `createMcpHandler` from `agents/mcp`
- Register tools via `server.tool()` in the init callback
- Auth types and functions imported from `@superbenefit/porch/auth` (not local)
- Security headers imported from `@superbenefit/porch/security`
- Every tool uses `resolveAuthContext()` + `checkTierAccess()` pattern:

```typescript
import { resolveAuthContext, checkTierAccess } from '@superbenefit/porch/auth';

server.tool('my_tool', 'description', { param: z.string() },
  async ({ param }) => {
    const authContext = await resolveAuthContext(env);
    const access = checkTierAccess('open', authContext);
    if (!access.allowed) {
      return {
        content: [{ type: 'text', text: `Requires ${access.requiredTier} access.` }],
        isError: true,
      };
    }
    // ... tool logic
  }
);
```

### Common Mistakes to Avoid

- ❌ Per-document reranker calls → ✅ Batch API with `contexts` array
- ❌ `batch.ackAll()` for queues → ✅ Per-message `msg.ack()`
- ❌ `topK: 100` with full metadata → ✅ Max 20, use 'indexed' for more
- ❌ R2 bucket CORS config for API → ✅ Hono middleware handles CORS
- ❌ Local auth files (`src/auth/`) → ✅ Import from `@superbenefit/porch/auth`

## Project Structure

```
src/
├── index.ts              # Main router (rate limiting, security headers, routing split)
├── types/
│   ├── index.ts          # Re-exports all types (auth from @superbenefit/porch/auth)
│   ├── content.ts        # 21 content type schemas, PATH_TYPE_MAP, inferContentType
│   ├── api.ts            # API request/response types
│   ├── storage.ts        # R2Document, VectorizeMetadata
│   └── sync.ts           # SyncParams, R2EventNotification
├── api/                  # Public REST API
│   ├── routes.ts         # Hono + OpenAPI routes (health, entries, search, openapi)
│   └── schemas.ts        # Zod schemas
├── mcp/
│   ├── server.ts         # createMcpServer factory
│   ├── tools.ts          # MCP tool registrations (auth from @superbenefit/porch/auth)
│   ├── resources.ts      # MCP resource definitions
│   └── prompts.ts        # MCP prompt templates
├── sync/
│   ├── workflow.ts       # GitHub sync workflow
│   ├── github.ts         # Webhook verification, file fetching
│   └── parser.ts         # Markdown parsing
├── consumers/
│   └── vectorize.ts      # Queue consumer
└── retrieval/
    ├── search.ts         # Vectorize queries
    └── rerank.ts         # BGE reranker
```

> **No `src/auth/` directory** — auth lives in `@superbenefit/porch/auth` (mcporch repo).

## Key Implementation Details

### Porch Access Control (Phase 1)

Auth functions live in mcporch (`@superbenefit/porch/auth`), not in this repo:

```typescript
import { resolveAuthContext, checkTierAccess } from '@superbenefit/porch/auth';

// Phase 1: always returns { identity: null, tier: 'open', address: null, roles: null }
const authContext = await resolveAuthContext(env);
const access = checkTierAccess('open', authContext);
```

### Two-Stage Retrieval

```typescript
// Stage 1: Vectorize with metadata filter
const results = await env.VECTORIZE.query(embedding, {
  topK: 20,
  filter: { contentType: 'article' },
  returnMetadata: 'all'
});

// Stage 2: Batch rerank
const reranked = await env.AI.run('@cf/baai/bge-reranker-base', {
  query: searchQuery,
  contexts: results.map(r => ({ text: r.content })),
  top_k: 10
});
```

### Router Integration

```typescript
// src/index.ts — rate limiting + security headers + routing split
import { SECURITY_HEADERS } from '@superbenefit/porch/security';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // Rate limiting on all requests (429 with SECURITY_HEADERS)
    // MCP → createMcpHandler (direct, security headers injected)
    // POST /webhook → handleWebhook (with replay protection via delivery ID)
    // Everything else → Hono (REST API at /api/v1)
    ...
  },
  queue: handleVectorizeQueue,
};
```

## Testing

```bash
# Start local dev server (no auth config needed!)
npm run dev

# MCP Inspector
npx @modelcontextprotocol/inspector
# Connect to http://localhost:8788/mcp

# REST API
curl http://localhost:8788/api/v1/health
curl http://localhost:8788/api/v1/entries
curl http://localhost:8788/api/v1/search?q=governance
curl http://localhost:8788/api/v1/openapi.json

# CORS verification
curl -I -X OPTIONS http://localhost:8788/api/v1/entries \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET"
```

## Important Constraints

- `compatibility_date`: "2025-03-07" or later for agents SDK
- Queue consumers: per-message `msg.ack()`, not `batch.ackAll()`
- R2 events have no ordering guarantee — use idempotent operations
- Vectorize metadata indexes must be created BEFORE inserting vectors

## Compaction Rules

When compacting, preserve:
- Full list of modified files
- Current implementation phase
- Outstanding TODOs
- Test results summary
- Any errors encountered

## Specification Reference

Full spec at: `docs/spec.md` (v0.16)
