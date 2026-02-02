import { z } from '@hono/zod-openapi';
import { ContentTypeSchema } from './content';

// Shared search filters (spec section 6.2)
export const SearchFiltersSchema = z.object({
  contentType: ContentTypeSchema.optional(),
  group: z.string().optional(),
  release: z.string().optional(),
  status: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

// Public tools
export const SearchKnowledgeInputSchema = z.object({
  query: z.string(),
  filters: SearchFiltersSchema.optional(),
});

export type SearchKnowledgeInput = z.infer<typeof SearchKnowledgeInputSchema>;

export const DefineTermInputSchema = z.object({
  term: z.string(),
});

export type DefineTermInput = z.infer<typeof DefineTermInputSchema>;

export const SearchLexiconInputSchema = z.object({
  keyword: z.string(),
});

export type SearchLexiconInput = z.infer<typeof SearchLexiconInputSchema>;

// Member tools
export const GetDocumentInputSchema = z.object({
  contentType: ContentTypeSchema,
  id: z.string(),
});

export type GetDocumentInput = z.infer<typeof GetDocumentInputSchema>;

export const SaveLinkInputSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
});

export type SaveLinkInput = z.infer<typeof SaveLinkInputSchema>;

export const SearchWithDocumentsInputSchema = z.object({
  query: z.string(),
  filters: SearchFiltersSchema.optional(),
});

export type SearchWithDocumentsInput = z.infer<typeof SearchWithDocumentsInputSchema>;

// Vibecoder tools
export const CreateDraftInputSchema = z.object({
  contentType: ContentTypeSchema,
  title: z.string(),
  content: z.string(),
});

export type CreateDraftInput = z.infer<typeof CreateDraftInputSchema>;
