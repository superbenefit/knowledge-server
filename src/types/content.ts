import { z } from '@hono/zod-openapi';

// Content type hierarchy (spec section 3.2)
export const ContentTypeSchema = z
  .enum(['note', 'reference', 'link', 'tag', 'artifact', 'article', 'guide', 'pattern', 'playbook'])
  .openapi('ContentType');

export type ContentType = z.infer<typeof ContentTypeSchema>;

// Parent types for hierarchy grouping
export const ARTIFACT_TYPES: ContentType[] = ['article', 'guide', 'pattern', 'playbook'];
export const REFERENCE_TYPES: ContentType[] = ['link', 'tag'];

// Path prefix → content type mapping
export const PATH_TYPE_MAP: Record<string, ContentType> = {
  'artifacts/articles': 'article',
  'artifacts/guides': 'guide',
  'artifacts/patterns': 'pattern',
  'artifacts/playbooks': 'playbook',
  'library': 'link',
  'tags': 'tag',
  'notes': 'note',
};

// Base frontmatter schema (spec section 3.3)
export const BaseSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    date: z.coerce.date(),
    publish: z.boolean().default(false),
  })
  .openapi('BaseFrontmatter');

export type BaseFrontmatter = z.infer<typeof BaseSchema>;

// Artifact frontmatter (extends base)
export const ArtifactSchema = BaseSchema.extend({
  hasPart: z.array(z.string()).optional(),
  isPartOf: z.array(z.string()).optional(),
  pattern: z.array(z.string()).optional(),
}).openapi('ArtifactFrontmatter');

export type ArtifactFrontmatter = z.infer<typeof ArtifactSchema>;

// Tag/lexicon frontmatter (extends base)
export const TagSchema = BaseSchema.extend({
  aliases: z.array(z.string()).optional(),
  relatedTerms: z.array(z.string()).optional(),
  category: z.string().optional(),
}).openapi('TagFrontmatter');

export type TagFrontmatter = z.infer<typeof TagSchema>;

// Normalized content entry stored in R2 (spec section 5.2)
export const ContentEntrySchema = z
  .object({
    id: z.string(),
    contentType: ContentTypeSchema,
    path: z.string(),
    metadata: BaseSchema,
    content: z.string(),
    syncedAt: z.string().datetime(),
    commitSha: z.string(),
  })
  .openapi('ContentEntry');

export type ContentEntry = z.infer<typeof ContentEntrySchema>;
