# Source (`src/`)

> WorkerEntrypoint class — HTTP routing, webhook handler, and RPC methods for inter-Worker service bindings.

**Source:** `src/index.ts`, `src/env.d.ts`
**Depends on:** `api` (Hono app), `mcp` (createMcpServer), `retrieval` (searchKnowledge, getDocument), `sync` (verifyWebhookSignature, isExcluded, KnowledgeSyncWorkflow), `types` (GitHubPushEvent, RPC types), `@superbenefit/porch/security` (SECURITY_HEADERS)
**Depended on by:** Cloudflare Workers runtime (worker entry point), consumer Workers via service bindings

---

## Overview

The index module exports `KnowledgeServer`, a `WorkerEntrypoint<Env>` class that serves as the single entry point for the Cloudflare Worker. The class provides two categories of interface:

1. **HTTP handlers** — `fetch()` implements a three-way routing split (MCP, webhook, Hono REST API) and `handleWebhook()` is a private class method for GitHub push events with `ctx.waitUntil()` for fire-and-forget workflow creation.
2. **RPC methods** — Five public methods (`searchKnowledge`, `getDocument`, `listGroups`, `listReleases`, `defineTerm`) callable via service bindings from other Workers with zero HTTP overhead.

The routing split is intentional — MCP requests bypass Hono entirely to avoid middleware interference (MCP uses SSE and has its own CORS handling), while the REST API benefits from Hono's middleware stack (CORS, validation, OpenAPI generation).

## Module Layout

```
src/
├── index.ts              # WorkerEntrypoint — HTTP, webhook, RPC
├── env.d.ts              # Cloudflare binding type declarations
├── types/                # Type system + content ontology + RPC types
├── api/                  # REST API (Hono + OpenAPI)
├── mcp/                  # MCP server (tools, resources, prompts)
├── retrieval/            # Search via AI Search (AutoRAG) + R2 fetch
└── sync/                 # GitHub sync workflow + markdown parsing
```

## Cloudflare Bindings

| Binding | Type | Description |
|---------|------|-------------|
| `GITHUB_TOKEN` | `string` | GitHub API authentication |
| `GITHUB_WEBHOOK_SECRET` | `string` | HMAC-SHA256 webhook verification |
| `GITHUB_REPO` | `string` | Repository in `owner/repo` format |
| `AI_SEARCH_API_TOKEN` | `string` | AI Search authentication |
| `CF_ACCOUNT_ID` | `string` | Cloudflare account ID |
| `SYNC_STATE` | `KVNamespace` | Sync state / replay protection |
| `KNOWLEDGE` | `R2Bucket` | Content storage |
| `AI` | `Ai` | Workers AI (AI Search / AutoRAG) |
| `SYNC_WORKFLOW` | `Workflow` | GitHub sync workflow trigger |
| `RATE_LIMITER` | `RateLimit` | Per-IP rate limiting |

## Cross-References

- [api](api/) — REST API mounted at `/api/v1`
- [mcp](mcp/) — MCP server at `/mcp`
- [retrieval](retrieval/) — AI Search queries + R2 document fetching
- [sync](sync/) — `KnowledgeSyncWorkflow`, `verifyWebhookSignature()`, `isExcluded()`
- [types](types/) — `GitHubPushEvent`, `Env` interface, RPC types
