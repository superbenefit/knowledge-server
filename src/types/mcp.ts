import { z } from '@hono/zod-openapi';
import { ContentTypeSchema } from './content';

// MCP tool input schemas (spec section 8.1)
// These are used for both MCP tool registration and REST API validation

// Public tools
export const SearchKnowledgeInputSchema = z.object({
  query: z.string(),
  contentType: ContentTypeSchema.optional(),
  limit: z.number().default(10),
});

export type SearchKnowledgeInput = z.infer<typeof SearchKnowledgeInputSchema>;

export const DefineTermInputSchema = z.object({
  term: z.string(),
});

export type DefineTermInput = z.infer<typeof DefineTermInputSchema>;

export const SearchLexiconInputSchema = z.object({
  query: z.string(),
});

export type SearchLexiconInput = z.infer<typeof SearchLexiconInputSchema>;

// Member tools
export const GetDocumentInputSchema = z.object({
  id: z.string(),
});

export type GetDocumentInput = z.infer<typeof GetDocumentInputSchema>;

export const AddTermInputSchema = z.object({
  term: z.string(),
  definition: z.string(),
  aliases: z.array(z.string()).optional(),
});

export type AddTermInput = z.infer<typeof AddTermInputSchema>;

export const SaveLinkInputSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  tags: z.array(z.string()).optional(),
});

export type SaveLinkInput = z.infer<typeof SaveLinkInputSchema>;

// Vibecoder tools
export const UpdateTermInputSchema = z.object({
  term: z.string(),
  definition: z.string().optional(),
  aliases: z.array(z.string()).optional(),
});

export type UpdateTermInput = z.infer<typeof UpdateTermInputSchema>;
