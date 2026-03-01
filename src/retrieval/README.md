# Retrieval

> Search and document fetch via Cloudflare AI Search (AutoRAG) and R2.

**Source:** `src/retrieval/`
**Files:** 3 (`index.ts`, `search.ts`, `fetch.ts`)
**Depends on:** `types` (`SearchFilters`, `SearchResult`, `ContentType`, `R2Document`, `toR2Key`)
**Depended on by:** `mcp` (tools), `api` (search route), `index.ts` (RPC methods)

---

## Overview

The retrieval module provides search and document fetch for both MCP tools and the REST API.

- **Search** uses Cloudflare AI Search (AutoRAG) via `env.AI.autorag()` — handles embedding, indexing, and ranking automatically.
- **Document fetch** reads JSON documents from R2 by content type + ID or source path.

## Data Flow

```
searchKnowledge(query, filters, options, env)
│
├─► searchViaAiSearch(query, { contentType }, env)
│   ├─► env.AI.autorag('knowledge-search').search({ query, rewrite_query: true })
│   ├─► Filter by contentType prefix if specified
│   └─► Map AI Search sources → SearchResult[]
│
└─► Return results
```

## File Reference

### `index.ts`

Orchestrator — re-exports individual functions and provides the `searchKnowledge()` entry point that maps `SearchFilters` to AI Search parameters.

| Export | Description |
|--------|-------------|
| `searchKnowledge(query, filters, options, env)` | Main entry point for search |
| `searchViaAiSearch` | Re-export from `./search` |
| `getDocument` | Re-export from `./fetch` |
| `getDocumentByPath` | Re-export from `./fetch` |

### `search.ts`

AI Search integration via `env.AI.autorag('knowledge-search').search()`.

| Export | Description |
|--------|-------------|
| `searchViaAiSearch(query, filters, env)` | Search via AutoRAG, map results to `SearchResult[]` |

Content type filtering is done post-query by matching R2 key prefixes (`content/{type}/` or `indexes/`).

### `fetch.ts`

R2 document retrieval.

| Export | Description |
|--------|-------------|
| `getDocument(contentType, id, env)` | Single document by type + ID |
| `getDocumentByPath(path, env)` | Single document by exact source path (scans R2) |

## Cloudflare Bindings

| Binding | Type | Usage |
|---------|------|-------|
| `AI` | `Ai` | AutoRAG search (`env.AI.autorag()`) |
| `KNOWLEDGE` | `R2Bucket` | Document storage |

## Cross-References

- [types](../types/) — `SearchResult`, `R2Document`, `ContentType`
- [mcp](../mcp/) — `search_knowledge` tool calls `searchKnowledge()`
- [api](../api/) — `GET /search` route calls `searchKnowledge()`
