import { z } from '@hono/zod-openapi';
import { ContentEntrySchema, ContentTypeSchema } from './content';

// List entries query params (spec section 9.3)
export const ListParamsSchema = z
  .object({
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
    contentType: ContentTypeSchema.optional(),
    category: z.string().optional(),
  })
  .openapi('ListParams');

export type ListParams = z.infer<typeof ListParamsSchema>;

// Search query params (spec section 9.3)
export const SearchParamsSchema = z
  .object({
    q: z.string().min(1),
    limit: z.coerce.number().min(1).max(50).default(10),
    contentType: ContentTypeSchema.optional(),
  })
  .openapi('SearchParams');

export type SearchParams = z.infer<typeof SearchParamsSchema>;

// Pagination metadata (spec section 9.4)
export const PaginationMetaSchema = z
  .object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
  })
  .openapi('PaginationMeta');

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

// Search result extends entry with score
export const SearchResultSchema = ContentEntrySchema.extend({
  score: z.number(),
}).openapi('SearchResult');

export type SearchResult = z.infer<typeof SearchResultSchema>;

// Error response envelope (spec section 9.4)
export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
  .openapi('ErrorResponse');

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Success response envelope (spec section 9.4)
export const EntryResponseSchema = z
  .object({
    data: ContentEntrySchema,
  })
  .openapi('EntryResponse');

export const EntryListResponseSchema = z
  .object({
    data: z.array(ContentEntrySchema),
    meta: PaginationMetaSchema,
  })
  .openapi('EntryListResponse');

export const SearchResponseSchema = z
  .object({
    data: z.array(SearchResultSchema),
    meta: PaginationMetaSchema,
  })
  .openapi('SearchResponse');
