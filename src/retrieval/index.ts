export { searchWithFilters, generateEmbedding } from './search';
export { rerankResults, hashQuery } from './rerank';
export { getDocuments, getDocument } from './fetch';

import type { SearchFilters, SearchResult, R2Document } from '../types';
import type { ContentType } from '../types';
import { searchWithFilters } from './search';
import { rerankResults } from './rerank';
import { getDocuments } from './fetch';

/**
 * Perform a full three-stage knowledge search.
 *
 * Stage 1: Vectorize similarity search with metadata filters (topK: 20)
 * Stage 2: BGE reranker with sigmoid normalization (filter >= 0.5)
 * Stage 3: Optionally fetch full R2 documents for top results
 *
 * @param query - Natural language search query
 * @param filters - Optional metadata filters
 * @param options - Search options (includeDocuments triggers Stage 3)
 * @param env - Cloudflare Worker environment bindings
 * @returns Array of SearchResult sorted by relevance
 */
export async function searchKnowledge(
  query: string,
  filters: SearchFilters,
  options: { includeDocuments?: boolean } = {},
  env: Env,
): Promise<SearchResult[]> {
  // Stage 1: Vector search with metadata filtering
  const matches = await searchWithFilters(query, filters, env);

  if (matches.length === 0) {
    return [];
  }

  // Stage 2: Rerank using metadata.content (no R2 fetch)
  const ranked = await rerankResults(query, matches, env);

  // Stage 3: Optionally fetch full documents (only for top results)
  let documents: R2Document[] = [];
  if (options.includeDocuments) {
    documents = await getDocuments(ranked, env);
  }

  // Build results
  return ranked.map((r, i) => ({
    id: r.id,
    contentType: r.metadata.contentType as ContentType,
    title: r.metadata.title,
    description: r.metadata.description,
    score: r.score,
    rerankScore: r.rerankScore,
    document: documents[i],
  }));
}
