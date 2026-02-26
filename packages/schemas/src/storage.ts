import { z } from 'zod';
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

// ---------------------------------------------------------------------------
// R2 document shape (spec section 4.1)
// ---------------------------------------------------------------------------

export const R2DocumentSchema = z.object({
  id: z.string(),
  contentType: ContentTypeSchema,
  path: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  content: z.string(),
  attachments: z.array(z.string()).optional(),
  syncedAt: z.string().datetime(),
  commitSha: z.string(),
});

export type R2Document = z.infer<typeof R2DocumentSchema>;

// ---------------------------------------------------------------------------
// ID generation and R2 key helpers (spec section 4.2)
// ---------------------------------------------------------------------------

/**
 * Generate document ID from file path.
 * Example: "artifacts/patterns/cell-governance.md" → "cell-governance"
 *
 * Slugifies the filename: lowercase, non-alphanumeric → hyphens,
 * collapsed and trimmed. Truncated to 64 bytes (Vectorize limit).
 *
 * Constraints:
 * - Max 64 bytes (Vectorize limit)
 * - URL-safe characters only (a-z, 0-9, hyphens)
 * - Unique within contentType namespace
 */
export function generateId(path: string): string {
  const filename = path.split('/').pop() || path;
  let id = filename
    .replace(/\.md$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');

  // Truncate to 64 bytes (Vectorize limit)
  // After slugifying, id is pure ASCII (a-z, 0-9, hyphens) so length === byte length
  if (id.length > VECTORIZE_LIMITS.VECTOR_ID_MAX_BYTES) {
    id = id.slice(0, VECTORIZE_LIMITS.VECTOR_ID_MAX_BYTES);
  }
  id = id.replace(/-$/, '');

  if (!id) {
    throw new Error(`Cannot generate valid ID from path: ${path}`);
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

// ---------------------------------------------------------------------------
// Attachment R2 key helper
// ---------------------------------------------------------------------------

/**
 * Validate and return an R2 key for an attachment file.
 *
 * The key is the relativePath itself (e.g. "attachments/images/banner.png").
 * Rejects path traversal attempts and paths that don't start with "attachments/".
 */
export function toAttachmentR2Key(relativePath: string): string {
  if (relativePath.includes('..')) {
    throw new Error(`Path traversal detected in attachment path: ${relativePath}`);
  }
  if (!relativePath.startsWith('attachments/')) {
    throw new Error(`Attachment path must start with "attachments/": ${relativePath}`);
  }
  return relativePath;
}
