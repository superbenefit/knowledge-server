# Knowledge Server - SuperBenefit MCP

## Project Context

Building an MCP server + public REST API for SuperBenefit DAO that:
- Authenticates via SIWE (Sign-In with Ethereum) + WaaP
- Authorizes via Hats Protocol on Optimism
- Serves knowledge base search tools via MCP
- Exposes read-only REST API for web/external access
- Syncs from GitHub to R2 to Vectorize

## Technical Stack

- Cloudflare Workers (stateless `createMcpHandler`)
- Hono for HTTP routing + REST API
- @hono/zod-openapi for OpenAPI generation
- workers-oauth-provider for OAuth wrapper
- viem/siwe for SIWE verification (NOT siwe package - Buffer issues)
- Hats Protocol SDK for role checking
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

### MCP Server Pattern

- Use stateless `createMcpHandler` from `agents/mcp` (NOT McpAgent Durable Object)
- Register tools via `server.tool()` in the init callback
- Use `requireTier()` wrapper for tier-gated tool permissions
- Current `src/index.ts` still uses McpAgent (legacy template) — will be replaced in Integration phase

### Common Mistakes to Avoid

- ❌ `npm install siwe` → ✅ Use `viem/siwe`
- ❌ Per-document reranker calls → ✅ Batch API with `contexts` array
- ❌ `batch.ackAll()` for queues → ✅ Per-message `msg.ack()`
- ❌ `topK: 100` with full metadata → ✅ Max 20, use 'indexed' for more
- ❌ R2 bucket CORS config for API → ✅ Hono middleware handles CORS

## Project Structure

```
src/
├── index.ts              # Main router
├── types/
│   ├── index.ts          # Re-exports all types
│   ├── content.ts        # Content schemas, PATH_TYPE_MAP, inferContentType
│   ├── auth.ts           # AuthProps, AccessTier, HATS_CONFIG
│   ├── api.ts            # API request/response types
│   ├── storage.ts        # R2Document, VectorizeMetadata
│   ├── sync.ts           # SyncParams, R2EventNotification
│   └── mcp.ts            # MCP tool input schemas
├── auth/
│   ├── siwe-handler.ts   # SIWE verification
│   ├── hats.ts           # Hats Protocol checks
│   └── ens.ts            # ENS resolution
├── api/                  # Public REST API
│   ├── routes.ts         # Hono + OpenAPI routes
│   └── schemas.ts        # Zod schemas
├── mcp/
│   ├── server.ts         # createMcpHandler setup
│   ├── tools.ts          # MCP tool registrations
│   ├── resources.ts      # MCP resource definitions
│   └── prompts.ts        # MCP prompt templates
├── sync/
│   ├── workflow.ts        # GitHub sync workflow
│   └── parser.ts          # Markdown parsing
├── consumers/
│   └── vectorize.ts      # Queue consumer
└── retrieval/
    ├── search.ts         # Vectorize queries
    └── rerank.ts         # BGE reranker
```

## Key Implementation Details

### SIWE Verification

```typescript
import { generateSiweNonce, parseSiweMessage, verifySiweMessage } from 'viem/siwe';

// Nonces: KV with 5-minute TTL, delete after use (single-use)
// Verification: use blockTag: 'safe' for EIP-1271 smart wallet support
```

### Hats Protocol

```typescript
import { treeIdToHatId } from '@hatsprotocol/sdk-v1-core';

// Chain: Optimism (10)
// Contract: 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137
// Tree ID: 30
// Contributor: path [3, 1] → tier 'vibecoder'
// Member: path [3, 5] → tier 'member'
```

### Two-Stage Retrieval

```typescript
// Stage 1: Vectorize with metadata filter
const results = await env.VECTORIZE.query(embedding, {
  topK: 50,
  filter: { contentType: 'article' },
  returnMetadata: 'indexed'  // Use 'indexed' for topK > 20
});

// Stage 2: Batch rerank
const reranked = await env.AI.run('@cf/baai/bge-reranker-base', {
  query: searchQuery,
  contexts: results.map(r => ({ text: r.content })),
  top_k: 10
});
// Returns: { response: Array<{ id: number, score: number }> }
// Normalize with sigmoid, filter >= 0.5
```

### REST API CORS

```typescript
import { cors } from 'hono/cors';

// CORS handled by Hono middleware, NOT R2 bucket config
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'HEAD', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Accept'],
  maxAge: 86400
}));
```

### Router Integration

```typescript
import { Hono } from 'hono';
import { api } from './api/routes';

const app = new Hono<{ Bindings: Env }>();

// Public REST API (no auth)
app.route('/api/v1', api);

// MCP server (OAuth/SIWE protected)
app.all('/mcp/*', (c) => oauthProvider.fetch(c.req.raw, c.env, c.executionCtx));
app.all('/authorize', (c) => oauthProvider.fetch(c.req.raw, c.env, c.executionCtx));
app.all('/token', (c) => oauthProvider.fetch(c.req.raw, c.env, c.executionCtx));
app.all('/siwe/*', (c) => oauthProvider.fetch(c.req.raw, c.env, c.executionCtx));

export default app;
```

## Testing

```bash
# MCP Inspector
npx @modelcontextprotocol/inspector
# Connect to http://localhost:8788/sse

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
- Use `viem/siwe`, NOT standalone `siwe` package
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

Full spec at: `docs/spec.md` (v0.11)

Implementation plan at: `docs/plan.md` (v2.6)
