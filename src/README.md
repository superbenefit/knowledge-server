# Index (Entry Point)

> WorkerEntrypoint class — HTTP routing, queue consumer, webhook handler, and RPC methods for inter-Worker service bindings.

**Source:** `src/index.ts`, `src/env.d.ts`
**Files:** 2
**Spec reference:** `docs/spec.md` sections 1, 5.1, 8, 9; `tmp/worker-rpc.md` v0.17
**Depends on:** `api` (Hono app), `mcp` (createMcpServer), `consumers` (handleVectorizeQueue), `retrieval` (searchKnowledge, getDocument), `sync` (verifyWebhookSignature, isExcluded, KnowledgeSyncWorkflow), `types` (GitHubPushEvent, RPC types), `@superbenefit/porch/security` (SECURITY_HEADERS)
**Depended on by:** Cloudflare Workers runtime (worker entry point), consumer Workers via service bindings

---

## Overview

The index module exports `KnowledgeServer`, a `WorkerEntrypoint<Env>` class that serves as the single entry point for the Cloudflare Worker. The class provides three categories of interface:

1. **HTTP handlers** — `fetch()` implements a three-way routing split (MCP, webhook, Hono REST API) and `handleWebhook()` is a private class method for GitHub push events with `ctx.waitUntil()` for fire-and-forget workflow creation.
2. **Queue consumer** — `queue()` delegates to `handleVectorizeQueue` for R2 event processing.
3. **RPC methods** — Five public methods (`searchKnowledge`, `getDocument`, `listGroups`, `listReleases`, `defineTerm`) callable via service bindings from other Workers with zero HTTP overhead.

The routing split is intentional — MCP requests bypass Hono entirely to avoid middleware interference (MCP uses SSE and has its own CORS handling), while the REST API benefits from Hono's middleware stack (CORS, validation, OpenAPI generation).

The MCP handler is created per-request inside `fetch()` because `createMcpServer(this.env)` requires the class instance's `this.env`, which is unavailable at module scope. This is the correct pattern for `WorkerEntrypoint`.

The file also re-exports `KnowledgeSyncWorkflow` at the module level so Cloudflare's runtime can discover it via the `class_name` configuration in `wrangler.jsonc`.

## Data Flow Diagram

```mermaid
graph TD
    Request["Incoming HTTP Request"] --> Fetch["KnowledgeServer.fetch()"]
    RPC["Service Binding Call"] --> RPCMethods["RPC Methods<br/>searchKnowledge, getDocument,<br/>listGroups, listReleases, defineTerm"]

    Fetch -->|"/mcp" or "/mcp/*"| MCP["createMcpHandler()<br/>Direct — bypasses Hono"]
    Fetch -->|"POST /webhook"| WH["this.handleWebhook()<br/>Private class method"]
    Fetch -->|everything else| Hono["Hono Router"]

    Hono -->|"/api/v1/*"| API["api routes<br/>(see api/)"]
    Hono -->|unmatched| 404["Hono 404"]

    WH --> Verify["verifyWebhookSignature()"]
    Verify -->|invalid| R403["403 Invalid signature"]
    Verify -->|valid| Branch{"ref === refs/heads/main?"}
    Branch -->|no| Ignore["{ status: 'ignored' }"]
    Branch -->|yes| Collect["Collect .md files<br/>filter excluded<br/>deduplicate"]
    Collect --> Trigger["ctx.waitUntil(<br/>SYNC_WORKFLOW.create())"]

    Queue["Queue Messages"] --> QueueHandler["KnowledgeServer.queue()<br/>handleVectorizeQueue()"]
```

## File-by-File Reference

### `index.ts`

**Purpose:** WorkerEntrypoint class — HTTP routing, webhook handling, queue consumer, and RPC methods.

#### Exports

| Export | Kind | Description |
|--------|------|-------------|
| `KnowledgeSyncWorkflow` | Re-export (class) | From `./sync/workflow` — required for wrangler class_name discovery |
| `default` | Class | `KnowledgeServer extends WorkerEntrypoint<Env>` — worker entry point |

#### Class Methods

| Method | Visibility | Description |
|--------|-----------|-------------|
| `fetch(request)` | public | HTTP routing — rate limiting, MCP, webhook, Hono REST API |
| `queue(batch)` | public | Queue consumer — delegates to `handleVectorizeQueue` |
| `handleWebhook(request)` | private | GitHub push event processing with `ctx.waitUntil()` |
| `searchKnowledge(params)` | public (RPC) | Three-stage search pipeline — returns `{ items, total }` |
| `getDocument(params)` | public (RPC) | Get document by contentType + id — returns `R2Document \| null` |
| `listGroups()` | public (RPC) | List all groups/cells — returns `{ groups }` |
| `listReleases()` | public (RPC) | List creative releases — returns `{ releases }` |
| `defineTerm(params)` | public (RPC) | Get term definition — returns `{ term, definition }` |

#### Internal Logic

**`fetch()` — Three-way routing split:**

```
Request URL pathname
├── /mcp or /mcp/* → createMcpHandler (per-request, needs this.env)
├── POST /webhook  → this.handleWebhook(request)
└── *              → app.fetch(request, this.env, this.ctx)  (Hono)
```

1. **MCP path** (`/mcp` or `/mcp/*`): Creates a new `McpServer` via `createMcpServer(this.env)` and wraps it with `createMcpHandler()`, bypassing Hono. Created per-request because `this.env` is unavailable at module scope.

2. **Webhook path** (`POST /webhook`): Delegates to private `handleWebhook()` class method, which has access to `this.ctx.waitUntil()` for fire-and-forget workflow creation.

3. **Everything else**: Goes through Hono, which mounts the REST API at `/api/v1`.

**`handleWebhook()` — GitHub push event processing (private class method):**

1. Verify webhook signature via `x-hub-signature-256` header. Returns 403 if invalid.
2. Replay protection via delivery ID nonce (24h TTL in KV).
3. Branch filter: only processes `refs/heads/main`.
4. Collect changed/deleted `.md` files from all commits, deduplicate.
5. Fire-and-forget: `this.ctx.waitUntil(SYNC_WORKFLOW.create(...))` — responds immediately.

**RPC methods** — thin wrappers over existing retrieval/MCP functions with input validation:

- `searchKnowledge` → validates query (non-empty) and limit (1-20), calls `searchKnowledge()` from retrieval
- `getDocument` → validates contentType + id required, calls `getDocument()` from retrieval
- `listGroups` / `listReleases` → no params, delegates to `mcp/tools` helpers
- `defineTerm` → validates term (non-empty), calls `getTermDefinition()` from `mcp/tools`

**Hono app** (module scope):

```typescript
const app = new Hono<{ Bindings: Env }>();
app.route('/api/v1', api);
```

The Hono app is minimal — it only mounts the API sub-application. All middleware (CORS, error handling) is defined within the API module itself. Receives `this.env` and `this.ctx` per-request via `app.fetch()`.

#### Dependencies
- **Internal:** `./api/routes` (api), `./mcp/server` (createMcpServer), `./mcp/tools` (listGroups, listReleases, getTermDefinition), `./consumers/vectorize` (handleVectorizeQueue), `./retrieval` (searchKnowledge, getDocument), `./sync/github` (verifyWebhookSignature, isExcluded), `./types/sync` (GitHubPushEvent), `./types/rpc` (RPC param/result types), `./sync/workflow` (KnowledgeSyncWorkflow — re-export), `@superbenefit/porch/security` (SECURITY_HEADERS)
- **External:** `hono` (Hono), `cloudflare:workers` (WorkerEntrypoint), `agents/mcp` (createMcpHandler)

---

### `env.d.ts`

**Purpose:** TypeScript declarations for Cloudflare Worker environment bindings, extending both the `Cloudflare.Env` namespace and the global `Env` interface.

#### Internal Logic

The file contains **two parallel declarations** of the same bindings:

1. **`declare namespace Cloudflare { interface Env { ... } }`** — Used by `cloudflare:workers` imports (e.g., `WorkflowEntrypoint<Env, ...>`). This is the Cloudflare SDK's convention.

2. **`interface Env { ... }`** — Used by Hono's `Bindings` type parameter and by functions that accept `env: Env` directly.

Both declarations are identical and must be kept in sync. This dual-declaration pattern is necessary because the Cloudflare SDK and Hono use different type resolution mechanisms.

#### Complete Binding Inventory

| Binding | Type | Category | Set Via | Description |
|---------|------|----------|---------|-------------|
| `GITHUB_TOKEN` | `string` | Secret | `wrangler secret put` | GitHub API authentication for file fetching |
| `GITHUB_WEBHOOK_SECRET` | `string` | Secret | `wrangler secret put` | HMAC-SHA256 key for webhook verification |
| `GITHUB_REPO` | `string` | Secret | `wrangler secret put` | Repository in `owner/repo` format |
| `RERANK_CACHE` | `KVNamespace` | KV | `wrangler.jsonc` | Caches reranker results (1-hour TTL) |
| `SYNC_STATE` | `KVNamespace` | KV | `wrangler.jsonc` | Sync state tracking (reserved for future use) |
| `KNOWLEDGE` | `R2Bucket` | R2 | `wrangler.jsonc` | Content storage (`content/{type}/{id}.json`) |
| `VECTORIZE` | `VectorizeIndex` | Vectorize | `wrangler.jsonc` | Semantic search index |
| `AI` | `Ai` | AI | `wrangler.jsonc` | Workers AI (BGE embedding + reranking) |
| `SYNC_WORKFLOW` | `Workflow` | Workflow | `wrangler.jsonc` | GitHub sync workflow trigger |
| `CF_ACCESS_AUD` | `string?` | Secret | Phase 2 | Cloudflare Access audience tag (optional, unused in Phase 1) |

#### Dependencies
- **External:** Cloudflare Workers runtime types (global)

---

## Key Types

| Type | Source | Description |
|------|--------|-------------|
| `Env` | `env.d.ts` | All Cloudflare bindings |
| `GitHubPushEvent` | `types/sync.ts` | Webhook payload shape |
| `SearchKnowledgeParams` | `types/rpc.ts` | RPC search input |
| `SearchKnowledgeResult` | `types/rpc.ts` | RPC search output |
| `GetDocumentParams` | `types/rpc.ts` | RPC get document input |
| `DefineTermParams` | `types/rpc.ts` | RPC define term input |
| `ListGroupsResult` | `types/rpc.ts` | RPC list groups output |
| `ListReleasesResult` | `types/rpc.ts` | RPC list releases output |

## Cloudflare Bindings Used

All bindings are used by this module or the modules it delegates to. See the Complete Binding Inventory table above for details.

## Configuration and Limits

| Setting | Value | Source |
|---------|-------|--------|
| Worker name | `knowledge-server` | `wrangler.jsonc` |
| Main entry | `src/index.ts` | `wrangler.jsonc` |
| Compatibility date | `2025-03-10` | `wrangler.jsonc` |
| Compatibility flags | `nodejs_compat` | `wrangler.jsonc` |
| Dev port | 8788 | `wrangler.jsonc` |
| Branch filter | `refs/heads/main` | `index.ts` |

### Wrangler Resource Configuration

| Resource | Name / ID | Config |
|----------|-----------|--------|
| KV: RERANK_CACHE | `bcfbd064dc2b451dbd05a85410b33196` | |
| KV: SYNC_STATE | `6b98b7a4d10746cf90cbfcdc559597ee` | |
| Workflow: SYNC_WORKFLOW | `knowledge-sync-workflow` (class: `KnowledgeSyncWorkflow`) | |
| Vectorize: VECTORIZE | `superbenefit-knowledge-idx` | `remote: true` |
| R2: KNOWLEDGE | `superbenefit-knowledge` | `remote: true` |
| Queue consumer | `superbenefit-knowledge-sync` | `max_batch_size: 10, max_batch_timeout: 30` |
| AI binding | `AI` | |
| Observability | enabled | |

## Error Handling

| Failure | Response |
|---------|----------|
| Invalid webhook signature | 403 `Invalid signature` |
| Non-main branch push | 200 `{ status: 'ignored', reason: 'not main branch' }` |
| No markdown changes | 200 `{ status: 'ignored', reason: 'no markdown files changed' }` |
| Workflow creation fails | Fire-and-forget via `waitUntil` — does not affect response |
| Unmatched route | Hono's default 404 handler |
| RPC invalid params | `throw new Error('RPC methodName: ...')` — propagated to caller |

## Extension Points

**Adding a new top-level route:**
1. For routes that need Hono middleware (CORS, validation): add to the Hono app or mount a sub-application
2. For routes that need custom handling (like MCP): add a pathname check in the `fetch` handler before the Hono fallthrough

**Phase 2 — adding authentication middleware:**
1. Add JWT verification before the MCP and/or API dispatches
2. Pass the verified identity through to `resolveAuthContext()` (which will need a request parameter in Phase 2)

**Adding a new queue consumer:**
1. Add a new consumer function
2. Export it alongside `handleVectorizeQueue` or create a dispatcher that routes by queue name

## Cross-References

- [api](api/) — REST API mounted at `/api/v1`
- [mcp](mcp/) — MCP server at `/mcp`
- [sync](sync/) — `KnowledgeSyncWorkflow`, `verifyWebhookSignature()`, `isExcluded()`
- [consumers](consumers/) — `handleVectorizeQueue()` wired to the `queue` export
- [types](types/) — `GitHubPushEvent`, `Env` interface
- `CLAUDE.md` — Router integration pattern
- `docs/spec.md` sections 1, 5.1, 8, 9 — Architecture, webhook handling, REST API, worker configuration
