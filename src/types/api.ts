import { z } from '@hono/zod-openapi';
import { ContentTypeSchema } from './content';
import { R2DocumentSchema, VectorizeMetadataSchema } from './storage';

// Shared search filters used by REST API and MCP tools (spec section 6.2)
export const SearchFiltersSchema = z.object({
  contentType: ContentTypeSchema.optional(),
  group: z.string().optional(),
  release: z.string().optional(),
  status: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

// List entries query params (spec section 8.2)
export const ListParamsSchema = z
  .object({
    contentType: ContentTypeSchema.optional(),
    group: z.string().optional(),
    release: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
  })
  .openapi('ListParams');

export type ListParams = z.infer<typeof ListParamsSchema>;

// Search query params (spec section 8.3)
export const SearchParamsSchema = z
  .object({
    q: z.string().min(1),
    contentType: ContentTypeSchema.optional(),
    group: z.string().optional(),
    release: z.string().optional(),
    limit: z.coerce.number().min(1).max(20).default(5),
  })
  .openapi('SearchParams');

export type SearchParams = z.infer<typeof SearchParamsSchema>;

// Lightweight search result (spec section 8.3)
export const SearchResultSchema = z
  .object({
    id: z.string(),
    contentType: ContentTypeSchema,
    title: z.string(),
    description: z.string().optional(),
    score: z.number(),
    rerankScore: z.number().optional(),
    document: R2DocumentSchema.optional(),
  })
  .openapi('SearchResult');

export type SearchResult = z.infer<typeof SearchResultSchema>;

// Reranked search result (spec section 6.3)
export const RerankResultSchema = z
  .object({
    id: z.string(),
    score: z.number(),
    rerankScore: z.number(),
    metadata: VectorizeMetadataSchema,
  })
  .openapi('RerankResult');

export type RerankResult = z.infer<typeof RerankResultSchema>;

// Error response envelope (spec section 8)
export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
  .openapi('ErrorResponse');

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Success response envelopes
export const EntryResponseSchema = z
  .object({
    data: R2DocumentSchema,
  })
  .openapi('EntryResponse');

export const EntryListResponseSchema = z
  .object({
    data: z.array(R2DocumentSchema),
    total: z.number(),
    offset: z.number(),
    limit: z.number(),
  })
  .openapi('EntryListResponse');

export const SearchResponseSchema = z
  .object({
    results: z.array(SearchResultSchema),
  })
  .openapi('SearchResponse');
