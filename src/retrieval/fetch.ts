import type { ContentType, R2Document } from '../types';
import { toR2Key } from '../types';

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

/**
 * Find a single document by its exact source path.
 * Scans all R2 content keys and returns the first match.
 *
 * @param path - The exact source path to match (e.g. "docs/governance.md")
 * @param env - Cloudflare Worker environment bindings
 * @returns The R2Document or null if not found
 */
export async function getDocumentByPath(
  path: string,
  env: Env,
): Promise<R2Document | null> {
  // Scan both content/ and indexes/ prefixes for path matches
  const prefixes = ['content/', 'indexes/'];

  for (const prefix of prefixes) {
    const allObjects: R2Object[] = [];
    let cursor: string | undefined;
    do {
      const listed = await env.KNOWLEDGE.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
      allObjects.push(...listed.objects);
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    const BATCH_SIZE = 50;
    for (let i = 0; i < allObjects.length; i += BATCH_SIZE) {
      const batch = allObjects.slice(i, i + BATCH_SIZE);
      const docs = await Promise.all(
        batch.map(async (obj): Promise<R2Document | null> => {
          const object = await env.KNOWLEDGE.get(obj.key);
          if (!object) return null;
          return object.json();
        }),
      );
      for (const doc of docs) {
        if (doc && doc.path === path) return doc;
      }
    }
  }
  return null;
}
