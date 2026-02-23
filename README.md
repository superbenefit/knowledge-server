# SuperBenefit Knowledge Server

MCP server + public REST API for SuperBenefit's knowledge base.

## What It Does

- **MCP Server** — AI tools (search, define, browse) via Model Context Protocol
- **REST API** — Read-only public API for web and external integrations
- **GitHub Sync** — Syncs knowledge base from GitHub to R2 to Vectorize

## Architecture

```
GitHub (superbenefit/knowledge-base)
         │ push webhook
         ▼
Sync Layer: Webhook → Workflow → R2 → Event → Queue → Vectorize
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  KnowledgeServer extends WorkerEntrypoint<Env>              │
│                                                             │
│  HTTP:                                                      │
│    /api/v1/*         REST API (Hono + OpenAPI)              │
│    /mcp              MCP Server (Tools, Resources, Prompts) │
│    /webhook          GitHub push events                     │
│                                                             │
│  RPC (service bindings — zero-latency inter-Worker calls):  │
│    searchKnowledge · getDocument · listGroups               │
│    listReleases · defineTerm                                │
│                                                             │
│  Queue: R2 event notifications → Vectorize indexing         │
│                                                             │
│  Access: resolveAuthContext() → checkTierAccess()           │
│  Phase 1: All tools Open tier (no auth)                     │
└─────────────────────────────────────────────────────────────┘
```

## Stack

- [Cloudflare Workers](https://developers.cloudflare.com/workers/) — Runtime
- [Hono](https://hono.dev/) + [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) — HTTP routing + OpenAPI
- [Vectorize](https://developers.cloudflare.com/vectorize/) — Semantic search
- [R2](https://developers.cloudflare.com/r2/) — Content storage
- [Queues](https://developers.cloudflare.com/queues/) — Event-driven indexing
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) + [Agents SDK](https://github.com/cloudflare/agents) — MCP server

## Quick Start

```bash
npm install
npm run dev          # Start local dev server on :8788
npm run type-check   # TypeScript type checking
npm run cf-typegen   # Regenerate Cloudflare binding types
```

## Testing

```bash
# MCP Inspector
npx @modelcontextprotocol/inspector
# Connect to http://localhost:8788/mcp

# REST API
curl http://localhost:8788/api/v1/entries
curl "http://localhost:8788/api/v1/search?q=governance"
curl http://localhost:8788/api/v1/openapi.json

# CORS verification
curl -I -X OPTIONS http://localhost:8788/api/v1/entries \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET"
```

## Project Structure

```
src/
├── index.ts              # WorkerEntrypoint class (HTTP, queue, RPC)
├── types/                # Type system + content ontology + RPC types
├── api/                  # REST API routes + OpenAPI
├── mcp/                  # MCP server (tools, resources, prompts)
├── retrieval/            # Three-stage search pipeline
├── sync/                 # GitHub sync workflow + markdown parsing
└── consumers/            # Queue consumer (R2 → Vectorize)
```

## Documentation

- [Specification](docs/spec.md) — Full architecture spec (v0.16)
- [Ontology](docs/ontology.md) — Content type definitions
- [CLAUDE.md](CLAUDE.md) — AI assistant context and code standards
- **Per-directory READMEs** — Each `src/` module has its own README

## Status

**Phase 1 (Foundation)** — Under active development. All tools Open tier, no auth required.

See [GitHub Issues](../../issues) for current progress.
