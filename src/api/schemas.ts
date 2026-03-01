import { z } from '@hono/zod-openapi';
import { ContentTypeSchema } from '../types/content';
import type { ContentType } from '../types/content';
import {
  EntryListResponseSchema,
  EntryResponseSchema,
  SearchResponseSchema,
  ErrorResponseSchema,
} from '../types/api';

// ---------------------------------------------------------------------------
// Route-level parameter schemas — built with hono's z for .openapi() support
// ---------------------------------------------------------------------------

export const EntryParamsSchema = z.object({
  contentType: z.enum(ContentTypeSchema.options as [ContentType, ...ContentType[]])
    .openapi({ param: { name: 'contentType', in: 'path' } }),
  id: z.string().min(1).openapi({ param: { name: 'id', in: 'path' } }),
});

export const ListQuerySchema = z.object({
  contentType: z.enum(ContentTypeSchema.options as [ContentType, ...ContentType[]]).optional()
    .openapi({ param: { name: 'contentType', in: 'query' } }),
  group: z.string().optional().openapi({ param: { name: 'group', in: 'query' } }),
  release: z.string().optional().openapi({ param: { name: 'release', in: 'query' } }),
  sourcePath: z.string().optional().openapi({ param: { name: 'sourcePath', in: 'query' } }),
  limit: z.coerce.number().min(1).max(100).default(20)
    .openapi({ param: { name: 'limit', in: 'query' } }),
  offset: z.coerce.number().min(0).default(0)
    .openapi({ param: { name: 'offset', in: 'query' } }),
});

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(5000).openapi({ param: { name: 'q', in: 'query' } }),
  contentType: z.enum(ContentTypeSchema.options as [ContentType, ...ContentType[]]).optional()
    .openapi({ param: { name: 'contentType', in: 'query' } }),
  group: z.string().optional().openapi({ param: { name: 'group', in: 'query' } }),
  release: z.string().optional().openapi({ param: { name: 'release', in: 'query' } }),
  limit: z.coerce.number().min(1).max(20).default(5)
    .openapi({ param: { name: 'limit', in: 'query' } }),
});

// ---------------------------------------------------------------------------
// Re-export response schemas for route definitions
// ---------------------------------------------------------------------------

export {
  EntryListResponseSchema,
  EntryResponseSchema,
  SearchResponseSchema,
  ErrorResponseSchema,
};
