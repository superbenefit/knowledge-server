export { getDocument, getDocumentByPath } from './fetch';
export { searchViaAiSearch } from './search';

import type { SearchFilters, SearchResult } from '../types';
import { searchViaAiSearch } from './search';

/**
 * Search the knowledge base using Cloudflare AI Search.
 *
 * Maintains backward compatibility with REST API and RPC callers.
 * Filters are mapped to AI Search parameters where supported.
 */
export async function searchKnowledge(
  query: string,
  filters: SearchFilters,
  _options: { includeDocuments?: boolean } = {},
  env: Env,
): Promise<SearchResult[]> {
  return searchViaAiSearch(query, { contentType: filters.contentType }, env);
}
