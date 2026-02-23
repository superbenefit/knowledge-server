import type { ContentType, R2Document, RerankResult } from '../types';
import { toR2Key } from '../types';

/**
 * Fetch full documents from R2 using metadata.path.
 * Only called for final top-K results after reranking.
 *
 * @param results - Reranked results with metadata.path pointing to R2 keys
 * @param env - Cloudflare Worker environment bindings
 * @returns Array of R2Document (nulls filtered out for missing objects)
 */
export async function getDocuments(
  results: RerankResult[],
  env: Env,
): Promise<Array<R2Document | undefined>> {
  return Promise.all(
    results.map(async (result) => {
      const path = result.metadata.path;
      if (!path) return undefined;

      const obj = await env.KNOWLEDGE.get(path);
      if (!obj) return undefined;

      return obj.json() as Promise<R2Document>;
    }),
  );
}

/**
 * Get a single document by ID and contentType.
 *
 * @param contentType - The content type of the document
 * @param id - The document ID
 * @param env - Cloudflare Worker environment bindings
 * @returns The R2Document or null if not found
 */
export async function getDocument(
  contentType: ContentType,
  id: string,
  env: Env,
): Promise<R2Document | null> {
  const key = toR2Key(contentType, id);
  const obj = await env.KNOWLEDGE.get(key);

  if (!obj) return null;
  return obj.json();
}
