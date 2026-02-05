export { searchVectorize, generateEmbedding } from './search';
export { rerankResults } from './rerank';

import type { SearchFilters, SearchResult } from '../types';
import type { ContentType } from '../types';
import { searchVectorize } from './search';
import { rerankResults } from './rerank';

/**
 * Perform a full two-stage knowledge search: vector search + rerank.
 *
 * Stage 1: Vectorize similarity search with metadata filters (topK: 20)
 * Stage 2: BGE reranker with sigmoid normalization (filter >= 0.5)
 *
 * @param query - Natural language search query
 * @param filters - Optional metadata filters
 * @param limit - Maximum results to return (default 5, max 20)
 * @param env - Cloudflare Worker environment bindings
 * @returns Array of SearchResult sorted by relevance
 */
export async function searchKnowledge(
  query: string,
  filters: SearchFilters,
  limit: number,
  env: Env,
): Promise<SearchResult[]> {
  // Stage 1: Vector search with metadata filtering
  const matches = await searchVectorize(query, filters, env);

  if (matches.length === 0) {
    return [];
  }

  // Stage 2: Rerank using metadata.content (no R2 fetch)
  const ranked = await rerankResults(query, matches, limit, env);

  // Build lightweight SearchResult objects
  return ranked.map((r) => ({
    id: r.id,
    contentType: r.metadata.contentType as ContentType,
    title: r.metadata.title,
    description: r.metadata.description,
    score: r.score,
    rerankScore: r.rerankScore,
  }));
}
