# Index (Entry Point)

> Main worker entry point — routes requests across MCP, REST API, and GitHub webhooks, and exports the queue consumer.

**Source:** `src/index.ts`, `src/env.d.ts`
**Files:** 2
**Spec reference:** `docs/spec.md` sections 1, 5.1, 8, 9
**Depends on:** `api` (Hono app), `mcp` (McpHandler), `consumers` (handleVectorizeQueue), `sync` (verifyWebhookSignature, isExcluded, KnowledgeSyncWorkflow), `types` (GitHubPushEvent)
**Depended on by:** Cloudflare Workers runtime (worker entry point)

---

## Overview

The index module is the single entry point for the Cloudflare Worker. It handles two runtime entrypoints: `fetch` (HTTP requests) and `queue` (queue message batches). The fetch handler implements a three-way routing split that directs requests to specialized handlers before they reach Hono's general-purpose router.

The routing split is intentional — MCP requests bypass Hono entirely to avoid middleware interference (MCP uses SSE and has its own CORS handling), while the REST API benefits from Hono's middleware stack (CORS, validation, OpenAPI generation). The webhook handler is also routed directly to avoid unnecessary middleware processing.

The file also contains the `handleWebhook()` function, which validates GitHub push events and triggers the sync workflow. Finally, it re-exports `KnowledgeSyncWorkflow` at the module level so Cloudflare's runtime can discover it via the `class_name` configuration in `wrangler.jsonc`.

## Data Flow Diagram

```mermaid
graph TD
    Request["Incoming Request"] --> Fetch["export default { fetch }"]

    Fetch -->|"/mcp" or "/mcp/*"| MCP["McpHandler.fetch()<br/>Direct — bypasses Hono"]
    Fetch -->|"POST /webhook"| WH["handleWebhook()<br/>Direct — bypasses Hono"]
    Fetch -->|everything else| Hono["Hono Router"]

    Hono -->|"/api/v1/*"| API["api routes<br/>(see api.md)"]
    Hono -->|unmatched| 404["Hono 404"]

    WH --> Verify["verifyWebhookSignature()"]
    Verify -->|invalid| R403["403 Invalid signature"]
    Verify -->|valid| Branch{"ref === refs/heads/main?"}
    Branch -->|no| Ignore["{ status: 'ignored' }"]
    Branch -->|yes| Collect["Collect .md files<br/>filter excluded<br/>deduplicate"]
    Collect --> Trigger["env.SYNC_WORKFLOW.create()"]

    Queue["Queue Messages"] --> QueueHandler["export default { queue }<br/>handleVectorizeQueue()"]
```

## File-by-File Reference

### `index.ts`

**Purpose:** Main worker module — HTTP routing, webhook handling, and runtime exports.

#### Exports

| Export | Kind | Description |
|--------|------|-------------|
| `KnowledgeSyncWorkflow` | Re-export (class) | From `./sync/workflow` — required for wrangler class_name discovery |
| `default` | Object | `{ fetch, queue }` — Worker module entry point |

#### Internal Logic

**`fetch` handler — Three-way routing split:**

```
Request URL pathname
├── /mcp or /mcp/* → McpHandler.fetch(request, env, ctx)
├── POST /webhook  → handleWebhook(request, env)
└── *              → app.fetch(request, env, ctx)  (Hono)
```

1. **MCP path** (`/mcp` or `/mcp/*`): Delegates directly to `McpHandler.fetch()`, bypassing Hono. This is critical because MCP uses its own transport (SSE/Streamable HTTP) and CORS configuration.

2. **Webhook path** (`POST /webhook`): Delegates to `handleWebhook()` for GitHub push event processing.

3. **Everything else**: Goes through Hono, which mounts the REST API at `/api/v1`.

**`queue` handler:**

Set to `handleVectorizeQueue` from `src/consumers/vectorize.ts`. Processes R2 event notifications from the queue.

**Hono app setup:**

```typescript
const app = new Hono<{ Bindings: Env }>();
app.route('/api/v1', api);
```

The Hono app is minimal — it only mounts the API sub-application. All middleware (CORS, error handling) is defined within the API module itself.

---

**`handleWebhook()` — GitHub push event processing:**

1. **Read body:** `await request.text()` (needed for both signature verification and JSON parsing)
2. **Verify signature:** Reads `x-hub-signature-256` header, calls `verifyWebhookSignature()`. Returns 403 if invalid.
3. **Parse payload:** `JSON.parse(body)` as `GitHubPushEvent`
4. **Branch filter:** Only processes pushes to `refs/heads/main`. Returns `{ status: 'ignored', reason: 'not main branch' }` otherwise.
5. **Collect files:**
   - Changed files: flattens `added` + `modified` from all commits, filters for `.md` extension and not excluded
   - Deleted files: flattens `removed` from all commits, filters for `.md` extension
   - Note: deleted files are NOT filtered through `isExcluded()` (excluded files that were previously synced should still be deletable)
6. **Deduplicate:** Uses `Set` to remove duplicates (a file may appear in multiple commits within the same push)
7. **Short-circuit:** If no markdown files changed, returns `{ status: 'ignored', reason: 'no markdown files changed' }`
8. **Trigger workflow:** `env.SYNC_WORKFLOW.create({ params: { changedFiles, deletedFiles, commitSha } })`
9. **Response:** `{ status: 'ok', changed: N, deleted: N }`

#### Dependencies
- **Internal:** `./api/routes` (api), `./mcp` (McpHandler), `./consumers/vectorize` (handleVectorizeQueue), `./sync/github` (verifyWebhookSignature, isExcluded), `./types/sync` (GitHubPushEvent), `./sync/workflow` (KnowledgeSyncWorkflow — re-export)
- **External:** `hono` (Hono)

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
| Workflow creation fails | Exception propagates (500) |
| Unmatched route | Hono's default 404 handler |

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

- [api.md](api.md) — REST API mounted at `/api/v1`
- [mcp.md](mcp.md) — MCP server at `/mcp`
- [sync.md](sync.md) — `KnowledgeSyncWorkflow`, `verifyWebhookSignature()`, `isExcluded()`
- [consumers.md](consumers.md) — `handleVectorizeQueue()` wired to the `queue` export
- [types.md](types.md) — `GitHubPushEvent`, `Env` interface
- `CLAUDE.md` — Router integration pattern
- `docs/spec.md` sections 1, 5.1, 8, 9 — Architecture, webhook handling, REST API, worker configuration
