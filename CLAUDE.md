# Knowledge Server - SuperBenefit MCP

## Project Context

Building an MCP server + public REST API for SuperBenefit DAO that:
- Serves knowledge base search tools via MCP
- Exposes read-only REST API for web/external access
- Syncs from GitHub to R2 via Workflows
- Searches via AI Search (AutoRAG)
- Uses porch access control framework (Phase 1: Open tier, no auth)

**Phase 1 (current):** All tools are Open tier — no authentication required.
**Phase 2 (future):** Add Public tier via Cloudflare Access for SaaS.
**Phase 3 (future):** Add Members tier via Hats Protocol / token gate.

## Technical Stack

- Cloudflare Workers (`WorkerEntrypoint` class with RPC methods + HTTP handlers)
- Hono for HTTP routing + REST API
- @hono/zod-openapi for OpenAPI generation
- AI Search (AutoRAG) for semantic search over R2 content
- R2 for content storage
- `@superbenefit/porch` (local `file:../mcporch`) for shared auth, security headers

## Code Standards

### Strict Requirements

- Default export is `class KnowledgeServer extends WorkerEntrypoint<Env>` — uses `this.env` / `this.ctx`
- NEVER use `addEventListener('fetch', ...)` or plain `export default { fetch }`
- Use Web standard APIs (Request, Response, URL)
- Import Cloudflare types from 'cloudflare:workers'
- RPC methods use camelCase (e.g., `searchKnowledge`, `getDocument`)

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

- ❌ R2 bucket CORS config for API → ✅ Hono middleware handles CORS
- ❌ Local auth files (`src/auth/`) → ✅ Import from `@superbenefit/porch/auth`

## Project Structure

```
src/
├── index.ts              # WorkerEntrypoint class (HTTP, webhook, RPC methods)
├── types/
│   ├── index.ts          # Re-exports all types (auth from @superbenefit/porch/auth)
│   ├── content.ts        # 21 content type schemas, PATH_TYPE_MAP, inferContentType
│   ├── api.ts            # API request/response types (re-exports from @superbenefit/knowledge-schemas)
│   ├── storage.ts        # R2Document, key helpers (re-exports from @superbenefit/knowledge-schemas)
│   ├── sync.ts           # SyncParams, GitHubPushEvent
│   └── rpc.ts            # RPC parameter/result types for service binding consumers
├── api/                  # Public REST API
│   ├── routes.ts         # Hono + OpenAPI routes (health, entries, search, openapi)
│   └── schemas.ts        # Zod schemas for route params/queries
├── mcp/
│   ├── server.ts         # createMcpServer factory
│   ├── tools.ts          # MCP tool registrations (auth from @superbenefit/porch/auth)
│   ├── resources.ts      # MCP resource definitions
│   └── prompts.ts        # MCP prompt templates
├── sync/
│   ├── workflow.ts       # GitHub sync workflow
│   ├── github.ts         # Webhook verification, file fetching
│   └── parser.ts         # Markdown parsing
└── retrieval/
    ├── index.ts          # searchKnowledge() entry point
    ├── search.ts         # AI Search (AutoRAG) queries
    └── fetch.ts          # R2 document fetching
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

### AI Search (AutoRAG)

```typescript
// Search via AI Search — searches R2 content directly
const result = await env.AI.autorag('knowledge-search').search({
  query: searchQuery,
  rewrite_query: true,
});

// Map sources to SearchResult shape
const results = result.data.map(source => ({
  id: extractIdFromKey(source.filename),
  contentType: extractContentTypeFromKey(source.filename),
  title: id.replace(/-/g, ' '),
  description: source.content?.[0]?.text?.slice(0, 500) || '',
  score: source.score,
}));
```

### WorkerEntrypoint + Router Integration

```typescript
// src/index.ts — WorkerEntrypoint with HTTP routing and RPC
import { WorkerEntrypoint } from 'cloudflare:workers';

export default class KnowledgeServer extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    // Rate limiting → MCP → webhook → Hono (REST API)
    // Uses this.env / this.ctx (not function args)
  }
  private async handleWebhook(request: Request): Promise<Response> { ... }

  // RPC methods — callable via service bindings from other Workers
  async searchKnowledge(params: SearchKnowledgeParams): Promise<SearchKnowledgeResult> { ... }
  async getDocument(params: GetDocumentParams): Promise<R2Document | null> { ... }
  async listGroups(): Promise<ListGroupsResult> { ... }
  async listReleases(): Promise<ListReleasesResult> { ... }
  async defineTerm(params: DefineTermParams): Promise<DefineTermResult> { ... }
}
```

Consumer apps call via service bindings: `await env.KNOWLEDGE_SERVER.searchKnowledge({ query: '...' })`

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

- `compatibility_date`: "2026-02-01" or later for agents SDK

## Compaction Rules

When compacting, preserve:
- Full list of modified files
- Current implementation phase
- Outstanding TODOs
- Test results summary
- Any errors encountered

## Specification Reference

Full spec at: `docs/spec.md` (v0.16)
