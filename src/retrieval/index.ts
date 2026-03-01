export { getDocument, getDocumentByPath } from './fetch';

import type { SearchFilters, SearchResult } from '../types';

/**
 * Search the knowledge base.
 *
 * Stub — will be replaced with AI Search API in the next step.
 */
export async function searchKnowledge(
  _query: string,
  _filters: SearchFilters,
  _options: { includeDocuments?: boolean } = {},
  _env: Env,
): Promise<SearchResult[]> {
  // TODO: Rewrite with AI Search API (task 5)
  return [];
}
