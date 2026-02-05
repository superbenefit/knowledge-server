import type { SearchFilters } from '../types';
import { VECTORIZE_LIMITS } from '../types';

/**
 * Generate an embedding vector for a query string using BGE base model.
 *
 * @param text - The text to embed
 * @param env - Cloudflare Worker environment bindings
 * @returns 768-dimensional embedding vector
 */
export async function generateEmbedding(
  text: string,
  env: Env,
): Promise<number[]> {
  const result = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [text],
  });
  if (!('data' in result) || !result.data || result.data.length === 0) {
    throw new Error('Embedding generation returned no data');
  }
  return result.data[0];
}

/**
 * Build a Vectorize metadata filter object from SearchFilters.
 *
 * Only includes fields that are actually specified in the filters,
 * so Vectorize won't apply unnecessary constraints.
 */
function buildVectorFilter(
  filters: SearchFilters,
): VectorizeVectorMetadataFilter | undefined {
  const filter: VectorizeVectorMetadataFilter = {};
  let hasFilter = false;

  if (filters.contentType) {
    filter['contentType'] = { $eq: filters.contentType };
    hasFilter = true;
  }
  if (filters.group) {
    filter['group'] = { $eq: filters.group };
    hasFilter = true;
  }
  if (filters.release) {
    filter['release'] = { $eq: filters.release };
    hasFilter = true;
  }
  if (filters.status) {
    filter['status'] = { $eq: filters.status };
    hasFilter = true;
  }
  if (filters.tags && filters.tags.length > 0) {
    // Tags are stored as comma-separated string in Vectorize metadata.
    // Use $in for any-match semantics across the tag values.
    filter['tags'] = { $in: filters.tags };
    hasFilter = true;
  }

  return hasFilter ? filter : undefined;
}

/**
 * Perform a Vectorize similarity search with optional metadata filters.
 *
 * Uses topK: 20 with returnMetadata: 'all' (Vectorize maximum when
 * returning full metadata). The returned matches include metadata.content
 * snippets used for reranking without additional R2 fetches.
 *
 * @param query - Natural language search query
 * @param filters - Optional metadata filters (contentType, group, etc.)
 * @param env - Cloudflare Worker environment bindings
 * @returns Array of VectorizeMatch results with metadata
 */
export async function searchVectorize(
  query: string,
  filters: SearchFilters,
  env: Env,
): Promise<VectorizeMatch[]> {
  const embedding = await generateEmbedding(query, env);

  const filter = buildVectorFilter(filters);

  const results = await env.VECTORIZE.query(embedding, {
    topK: VECTORIZE_LIMITS.TOP_K_WITH_METADATA,
    returnMetadata: 'all',
    filter,
  });

  return results.matches;
}
