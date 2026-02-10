import { z } from '@hono/zod-openapi';
import { ContentTypeSchema, type ContentType } from './content';

// ---------------------------------------------------------------------------
// Vectorize limits (spec Appendix C)
// ---------------------------------------------------------------------------

export const VECTORIZE_LIMITS = {
  METADATA_MAX_BYTES: 10 * 1024,       // 10 KiB per vector
  VECTOR_ID_MAX_BYTES: 64,
  STRING_INDEX_MAX_BYTES: 64,          // First 64 bytes indexed for filtering
  TOP_K_WITH_METADATA: 20,
  TOP_K_WITHOUT_METADATA: 100,
  MAX_METADATA_INDEXES: 10,
} as const;

// Vectorize namespace for multi-tenant support (spec section 4.3)
// Allows future expansion to other DAOs/content sources
export const VECTORIZE_NAMESPACE = 'superbenefit' as const;

// ---------------------------------------------------------------------------
// R2 document shape (spec section 4.1)
// ---------------------------------------------------------------------------

export const R2DocumentSchema = z.object({
  id: z.string(),
  contentType: ContentTypeSchema,
  path: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  content: z.string(),
  syncedAt: z.string().datetime(),
  commitSha: z.string(),
}).openapi('R2Document');

export type R2Document = z.infer<typeof R2DocumentSchema>;

// ---------------------------------------------------------------------------
// Vectorize metadata (spec section 4.3–4.4)
// Total must be under 10 KiB per vector
// ---------------------------------------------------------------------------

export const VectorizeMetadataSchema = z.object({
  // Indexed fields (6 of 10 max) — ~200 bytes
  contentType: z.string(),
  group: z.string(),
  tags: z.string(),            // Comma-separated
  release: z.string(),
  status: z.string(),
  date: z.number(),            // Unix timestamp ms

  // Non-indexed fields (for retrieval/reranking) — ~8800 bytes
  path: z.string(),            // R2 object key for document fetch
  title: z.string(),
  description: z.string(),
  content: z.string(),         // Truncated body for reranking
}).openapi('VectorizeMetadata');

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

// ---------------------------------------------------------------------------
// ID generation and R2 key helpers (spec section 4.2)
// ---------------------------------------------------------------------------

/**
 * Generate document ID from file path.
 * Example: "artifacts/patterns/cell-governance.md" → "cell-governance"
 *
 * Constraints:
 * - Max 64 bytes (Vectorize limit)
 * - URL-safe characters only
 * - Unique within contentType namespace
 */
export function generateId(path: string): string {
  const filename = path.split('/').pop() || path;
  const id = filename.replace(/\.md$/, '');

  if (new TextEncoder().encode(id).length > VECTORIZE_LIMITS.VECTOR_ID_MAX_BYTES) {
    throw new Error(`ID exceeds 64 byte limit: ${id}`);
  }

  return id;
}

/**
 * Construct R2 object key from contentType and ID.
 * Example: ("pattern", "cell-governance") → "content/pattern/cell-governance.json"
 */
export function toR2Key(contentType: ContentType, id: string): string {
  // Security: Prevent path traversal attacks
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw new Error(`Invalid characters in document ID: ${id}`);
  }
  return `content/${contentType}/${id}.json`;
}

/**
 * Extract ID from R2 object key.
 * Example: "content/pattern/cell-governance.json" → "cell-governance"
 */
export function extractIdFromKey(key: string): string {
  const parts = key.split('/');
  const filename = parts[parts.length - 1];
  return filename.replace(/\.json$/, '');
}

/**
 * Extract contentType from R2 object key.
 * Example: "content/pattern/cell-governance.json" → "pattern"
 */
export function extractContentTypeFromKey(key: string): ContentType {
  const parts = key.split('/');
  return parts[1] as ContentType;
}
