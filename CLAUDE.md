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
- viem/siwe for SIWE verification (dormant — Phase 3)
- Hats Protocol SDK for role checking (dormant — Phase 3)
- Vectorize for semantic search
- R2 for content storage
- Queues for event-driven indexing

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
- Every tool uses `resolveAuthContext()` + `checkTierAccess()` pattern:

```typescript
import { resolveAuthContext } from '../auth/resolve';
import { checkTierAccess } from '../auth/check';

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

- ❌ `npm install siwe` → ✅ Use `viem/siwe`
- ❌ Per-document reranker calls → ✅ Batch API with `contexts` array
- ❌ `batch.ackAll()` for queues → ✅ Per-message `msg.ack()`
- ❌ `topK: 100` with full metadata → ✅ Max 20, use 'indexed' for more
- ❌ R2 bucket CORS config for API → ✅ Hono middleware handles CORS

## Project Structure

```
src/
├── index.ts              # Main router (routing split: MCP direct, REST through Hono)
├── types/
│   ├── index.ts          # Re-exports all types
│   ├── content.ts        # Content schemas, PATH_TYPE_MAP, inferContentType
│   ├── auth.ts           # AccessTier, AuthContext, Identity, HATS_CONFIG
│   ├── api.ts            # API request/response types
│   ├── storage.ts        # R2Document, VectorizeMetadata
│   ├── sync.ts           # SyncParams, R2EventNotification
│   └── mcp.ts            # MCP tool input schemas
├── auth/
│   ├── resolve.ts        # resolveAuthContext() — porch framework core
│   ├── check.ts          # checkTierAccess() — tier comparison
│   ├── siwe-handler.ts   # SIWE verification (dormant — Phase 3)
│   ├── hats.ts           # Hats Protocol checks (dormant — Phase 3)
│   ├── ens.ts            # ENS resolution (dormant — Phase 3)
│   └── index.ts          # Exports
├── api/                  # Public REST API
│   ├── routes.ts         # Hono + OpenAPI routes
│   └── schemas.ts        # Zod schemas
├── mcp/
│   ├── server.ts         # createMcpHandler setup
│   ├── tools.ts          # MCP tool registrations
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

## Key Implementation Details

### Porch Access Control (Phase 1)

```typescript
// src/auth/resolve.ts — always returns open tier in Phase 1
export async function resolveAuthContext(_env: Env): Promise<AuthContext> {
  return { identity: null, tier: 'open', address: null, roles: null };
}

// src/auth/check.ts — tier comparison
export function checkTierAccess(requiredTier: AccessTier, authContext: AuthContext) {
  if (TIER_LEVEL[authContext.tier] >= TIER_LEVEL[requiredTier]) {
    return { allowed: true, authContext };
  }
  return { allowed: false, requiredTier, currentTier: authContext.tier };
}
```

### Hats Protocol (Dormant — Phase 3)

```typescript
import { treeIdToHatId } from '@hatsprotocol/sdk-v1-core';

// Chain: Optimism (10)
// Contract: 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137
// Tree ID: 30
// Contributor: path [3, 1] → tier 'members'
// Member: path [3, 5] → tier 'members'
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
// src/index.ts — routing split
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // MCP server — direct to handler, bypassing Hono
    if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) {
      return McpHandler.fetch(request, env, ctx);
    }

    // GitHub webhook
    if (url.pathname === '/webhook' && request.method === 'POST') {
      return handleWebhook(request, env);
    }

    // Everything else through Hono (REST API, health checks)
    return app.fetch(request, env, ctx);
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
- Use `viem/siwe`, NOT standalone `siwe` package (dormant — Phase 3)
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

Full spec at: `docs/spec.md` (v0.12)

Implementation plan at: `docs/plan.md` (v2.7)

Access control: `docs/porch-spec.md` (v0.14)
