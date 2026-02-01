import { z } from '@hono/zod-openapi';
import { ContentTypeSchema } from './content';

// R2 document shape (spec section 6.3 — what's stored in R2 JSON files)
export const R2DocumentSchema = z.object({
  id: z.string(),
  contentType: ContentTypeSchema,
  path: z.string(),
  metadata: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.string(),
    publish: z.boolean(),
    // Additional frontmatter fields vary by content type
  }).passthrough(),
  content: z.string(),
  syncedAt: z.string().datetime(),
  commitSha: z.string(),
});

export type R2Document = z.infer<typeof R2DocumentSchema>;

// Vectorize record metadata shape (spec section 4.2)
// These fields must have metadata indexes created BEFORE inserting vectors
export const VectorizeMetadataSchema = z.object({
  contentType: z.string(),  // indexed: string
  status: z.string(),       // indexed: string ("published" | "draft")
  publish: z.string(),      // indexed: string ("true" | "false")
  category: z.string(),     // indexed: string
  createdAt: z.number(),    // indexed: number (epoch ms)
  // Non-indexed metadata (stored but not filterable)
  title: z.string(),
  syncedAt: z.string(),
});

export type VectorizeMetadata = z.infer<typeof VectorizeMetadataSchema>;

// R2 key structure constants
export const R2_KEYS = {
  content: (contentType: string, id: string) => `content/${contentType}/${id}.json`,
  raw: (contentType: string, id: string) => `raw/${contentType}/${id}.md`,
  manifest: 'metadata/manifest.json',
} as const;
