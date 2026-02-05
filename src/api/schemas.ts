import { z } from '@hono/zod-openapi';
import { ContentTypeSchema } from '../types/content';
import {
  ListParamsSchema,
  SearchParamsSchema,
  EntryListResponseSchema,
  EntryResponseSchema,
  SearchResponseSchema,
  ErrorResponseSchema,
} from '../types/api';

// ---------------------------------------------------------------------------
// Route-level parameter schemas
// ---------------------------------------------------------------------------

export const EntryParamsSchema = z.object({
  contentType: ContentTypeSchema.openapi({ param: { name: 'contentType', in: 'path' } }),
  id: z.string().min(1).openapi({ param: { name: 'id', in: 'path' } }),
});

export const ListQuerySchema = ListParamsSchema.openapi('ListQuery');

export const SearchQuerySchema = SearchParamsSchema.openapi('SearchQuery');

// ---------------------------------------------------------------------------
// Re-export response schemas for route definitions
// ---------------------------------------------------------------------------

export {
  EntryListResponseSchema,
  EntryResponseSchema,
  SearchResponseSchema,
  ErrorResponseSchema,
};
