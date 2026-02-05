import type { RerankResult, VectorizeMetadata } from '../types';

/** Default top_k for the reranker model (spec section 6.3). */
const RERANK_TOP_K = 5;

/**
 * Apply sigmoid function to normalize raw reranker logits to [0, 1].
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Generate a simple hash string from query + match IDs for cache keying.
 */
export function hashQuery(query: string, ids: string[]): string {
  const input = query + ':' + ids.sort().join(',');
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

/**
 * Rerank Vectorize matches using the BGE reranker model.
 *
 * Uses the batch API pattern: a single call to @cf/baai/bge-reranker-base
 * with all candidate contexts. Content snippets come from Vectorize metadata
 * (no R2 fetches needed during reranking).
 *
 * Results are normalized with sigmoid and filtered to scores >= 0.5.
 * Cached in RERANK_CACHE KV with 1-hour TTL.
 *
 * @param query - The original search query
 * @param matches - Vectorize matches from the search stage
 * @param env - Cloudflare Worker environment bindings
 * @returns Reranked and filtered results sorted by rerankScore descending
 */
export async function rerankResults(
  query: string,
  matches: VectorizeMatch[],
  env: Env,
): Promise<RerankResult[]> {
  if (matches.length === 0) return [];

  // Check cache
  const cacheKey = `rerank:${hashQuery(query, matches.map(m => m.id))}`;
  const cached = await env.RERANK_CACHE.get<RerankResult[]>(cacheKey, 'json');
  if (cached) return cached;

  // Extract content snippets from metadata for reranking context.
  // Falls back to description, then empty string.
  const contexts = matches.map((m) => ({
    text: (m.metadata?.['content'] as string)
      || (m.metadata?.['description'] as string)
      || '',
  }));

  // Single batch reranker call (spec §6.3: top_k: 5)
  const result = await env.AI.run('@cf/baai/bge-reranker-base', {
    query,
    contexts,
    top_k: RERANK_TOP_K,
  });

  // Map reranker output back to original matches, apply sigmoid, filter >= 0.5
  const ranked: RerankResult[] = [];
  if (!result.response) return ranked;

  for (const r of result.response) {
    if (r.id == null || r.score == null) continue;
    const normalizedScore = sigmoid(r.score);
    if (normalizedScore < 0.5) continue;

    const match = matches[r.id];
    ranked.push({
      id: match.id,
      score: match.score,
      rerankScore: normalizedScore,
      metadata: match.metadata as unknown as VectorizeMetadata,
    });
  }

  // Sort by rerankScore descending
  ranked.sort((a, b) => b.rerankScore - a.rerankScore);

  // Cache results for 1 hour
  await env.RERANK_CACHE.put(cacheKey, JSON.stringify(ranked), {
    expirationTtl: 3600,
  });

  return ranked;
}
