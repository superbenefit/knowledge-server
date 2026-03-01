import type { SearchResult, ContentType } from '../types';
import { extractIdFromKey, extractContentTypeFromKey } from '../types/storage';

/**
 * Search the knowledge base via Cloudflare AI Search (AutoRAG).
 *
 * Uses the .search() method which returns scored sources without an AI response.
 * Maps AI Search sources to the existing SearchResult shape.
 * The `filename` field contains the R2 key (e.g. "content/pattern/cell-governance.json").
 */
export async function searchViaAiSearch(
  query: string,
  filters: { contentType?: ContentType },
  env: Env,
): Promise<SearchResult[]> {
  const result = await env.AI.autorag('knowledge-search').search({
    query,
    rewrite_query: true,
  });

  if (!result.data?.length) {
    return [];
  }

  let sources = result.data;

  // Filter by contentType if specified (match against R2 key prefix)
  if (filters.contentType) {
    const prefix = filters.contentType === 'index'
      ? 'indexes/'
      : `content/${filters.contentType}/`;
    sources = sources.filter((s) => s.filename.startsWith(prefix));
  }

  return sources.map((source) => {
    const id = extractIdFromKey(source.filename);
    const contentType = extractContentTypeFromKey(source.filename);
    // Use first content chunk as description
    const description = source.content?.[0]?.text?.slice(0, 500) || '';
    // Extract title from the id (best we can do without R2 fetch)
    const title = id.replace(/-/g, ' ');

    return {
      id,
      contentType,
      title,
      description,
      score: source.score,
    };
  });
}
