import type { RerankResult } from '../types';
import { VectorizeMetadataSchema } from '../types/storage';

/** Default top_k for the reranker model (spec section 6.3). */
const RERANK_TOP_K = 5;

/**
 * Apply sigmoid function to normalize raw reranker logits to [0, 1].
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Generate a cryptographically secure hash for cache keying.
 * Uses SHA-256 truncated to 16 hex chars (64 bits of collision resistance).
 */
export async function hashQuery(query: string, ids: string[]): Promise<string> {
  const input = query + ':' + ids.sort().join(',');
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
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
  const cacheKey = `rerank:${await hashQuery(query, matches.map(m => m.id))}`;
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
    // Security: Validate metadata with Zod instead of unsafe cast
    const metadataResult = VectorizeMetadataSchema.safeParse(match.metadata);
    if (!metadataResult.success) {
      console.error(`Invalid metadata for match ${match.id}: ${metadataResult.error.message}`);
      continue; // Skip invalid entries
    }
    ranked.push({
      id: match.id,
      score: match.score,
      rerankScore: normalizedScore,
      metadata: metadataResult.data,
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
