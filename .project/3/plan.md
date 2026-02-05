# Package 2: Retrieval Module

**Issue:** #3
**Branch:** `claude/implement-retrieval-module-Ndylo`
**Spec Reference:** v0.11, Section 6 (Retrieval System)
**Plan Reference:** v2.6, Package 2

## Scope

Implement the two-stage retrieval system:
1. **search.ts** — Vectorize queries with metadata filters, topK handling
2. **rerank.ts** — Batch BGE reranker with sigmoid normalization
3. **index.ts** — `searchKnowledge()` orchestrator combining search + rerank

## Files

```
src/retrieval/
├── search.ts      # Vectorize search with filters
├── rerank.ts      # BGE reranker batch API
└── index.ts       # searchKnowledge() orchestrator + exports
```

## Key Design Decisions

- **topK: 20** with `returnMetadata: 'all'` (Vectorize max when returning metadata)
- **Batch reranker** — single `@cf/baai/bge-reranker-base` call with `contexts` array
- **Sigmoid normalization** — raw reranker logits normalized via `1 / (1 + exp(-x))`
- **Filter >= 0.5** — only return results with sigmoid score >= 0.5
- **Rerank cache** — KV with 1-hour TTL using hash of query + match IDs
- **No R2 fetch during rerank** — uses `metadata.content` from Vectorize results
- All functions accept `env: Env` for Cloudflare bindings access

## Dependencies

- `src/types/api.ts` — SearchFilters, SearchResult, RerankResult
- `src/types/storage.ts` — VectorizeMetadata, VECTORIZE_LIMITS
- `src/types/content.ts` — ContentType
- Cloudflare bindings: `AI`, `VECTORIZE`, `RERANK_CACHE`
