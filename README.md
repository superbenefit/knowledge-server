# SuperBenefit Knowledge Server

MCP server + public REST API for SuperBenefit DAO's knowledge base.

## What it does

- **MCP Server** — Serves AI tools (search, define, browse) via Model Context Protocol
- **REST API** — Read-only public API for web and external integrations
- **GitHub Sync** — Syncs knowledge base from GitHub → R2 → Vectorize
- **Ethereum Auth** — SIWE authentication + Hats Protocol authorization on Optimism

## Stack

- [Cloudflare Workers](https://developers.cloudflare.com/workers/) — Runtime
- [Hono](https://hono.dev/) + [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) — HTTP routing + OpenAPI
- [Vectorize](https://developers.cloudflare.com/vectorize/) — Semantic search
- [R2](https://developers.cloudflare.com/r2/) — Content storage
- [Queues](https://developers.cloudflare.com/queues/) — Event-driven indexing
- [viem/siwe](https://viem.sh/docs/siwe/utilities/parseSiweMessage) — SIWE verification
- [Hats Protocol](https://www.hatsprotocol.xyz/) — Role-based access control

## Development

```bash
npm install
npm run dev          # Start local dev server on :8788
npm run type-check   # TypeScript type checking
npm run cf-typegen   # Regenerate Cloudflare binding types
```

### Testing

```bash
# MCP Inspector
npx @modelcontextprotocol/inspector
# Connect to http://localhost:8788/sse

# REST API
curl http://localhost:8788/api/v1/entries
curl http://localhost:8788/api/v1/search?q=governance
```

## Documentation

- [Specification](docs/spec.md) (v0.11) — Full architecture and API spec
- [Implementation Plan](docs/plan.md) (v2.6) — Phased build plan
- [CLAUDE.md](CLAUDE.md) — AI assistant context and code standards
- **Source Documentation** (`docs/src/`) — Per-directory developer guides:
  - [index.md](docs/src/index.md) — Entry point + routing
  - [types.md](docs/src/types.md) — Type system + content ontology
  - [auth.md](docs/src/auth.md) — Porch access control framework
  - [mcp.md](docs/src/mcp.md) — MCP server (tools, resources, prompts)
  - [api.md](docs/src/api.md) — REST API routes + OpenAPI
  - [retrieval.md](docs/src/retrieval.md) — Three-stage search pipeline
  - [sync.md](docs/src/sync.md) — GitHub sync workflow + markdown parsing
  - [consumers.md](docs/src/consumers.md) — Queue consumer (R2 → Vectorize)

## Status

Under active development. See [GitHub Issues](../../issues) for current progress.
