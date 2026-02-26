import { z } from 'zod';

// Shared schemas — canonical definitions in @superbenefit/knowledge-schemas
export {
  VECTORIZE_LIMITS,
  R2DocumentSchema,
  generateId,
  toR2Key,
  toAttachmentR2Key,
  extractIdFromKey,
  extractContentTypeFromKey,
} from '@superbenefit/knowledge-schemas';
export type { R2Document } from '@superbenefit/knowledge-schemas';

// Re-import for local use
import { VECTORIZE_LIMITS } from '@superbenefit/knowledge-schemas';

// Vectorize namespace for multi-tenant support (spec section 4.3)
// Allows future expansion to other DAOs/content sources
export const VECTORIZE_NAMESPACE = 'superbenefit' as const;

// ---------------------------------------------------------------------------
// Vectorize metadata (spec section 4.3–4.4)
// Total must be under 10 KiB per vector
// ---------------------------------------------------------------------------

export const VectorizeMetadataSchema = z.object({
  // Indexed fields (6 of 10 max) — ~200 bytes
  contentType: z.string(),
  group: z.string(),
  tags: z.array(z.string()),   // Stored as array, filtered post-query
  release: z.string(),
  status: z.string(),
  date: z.number(),            // Unix timestamp ms

  // Non-indexed fields (for retrieval/reranking) — ~8800 bytes
  path: z.string(),            // R2 object key for document fetch
  title: z.string(),
  description: z.string(),
  content: z.string(),         // Truncated body for reranking
});

export type VectorizeMetadata = z.infer<typeof VectorizeMetadataSchema>;

// ---------------------------------------------------------------------------
// Content truncation for metadata (spec section 4.4)
// ---------------------------------------------------------------------------

const MAX_CONTENT_LENGTH = 8000; // ~8KB, leaves room for other fields

export function truncateForMetadata(content: string): string {
  if (content.length <= MAX_CONTENT_LENGTH) return content;

  const truncated = content.slice(0, MAX_CONTENT_LENGTH);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.slice(0, lastSpace) + '...';
}
