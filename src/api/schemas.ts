import { z } from '@hono/zod-openapi';
import {
  ContentTypeSchema,
  FileSchema,
  ResourceSchema,
  StorySchema,
  LinkSchema,
  TagSchema,
  PatternSchema,
  PracticeSchema,
  PrimitiveSchema,
  ProtocolSchema,
  QuestionSchema,
  ArticleSchema,
  PersonSchema,
  GroupSchema,
  ProjectSchema,
  PlaceSchema,
  GatheringSchema,
} from '../types/content';
import { R2DocumentSchema, VectorizeMetadataSchema } from '../types/storage';
import {
  ListParamsSchema,
  SearchParamsSchema,
  SearchResultSchema,
  RerankResultSchema,
  ErrorResponseSchema,
  EntryResponseSchema,
  EntryListResponseSchema,
  SearchResponseSchema,
} from '../types/api';

// ---------------------------------------------------------------------------
// OpenAPI component name registrations
// Moved here from type files so schemas package stays free of @hono/zod-openapi
// ---------------------------------------------------------------------------

// Content schemas
ContentTypeSchema.openapi('ContentType');
FileSchema.openapi('FileFrontmatter');
ResourceSchema.openapi('ResourceFrontmatter');
StorySchema.openapi('StoryFrontmatter');
LinkSchema.openapi('LinkFrontmatter');
TagSchema.openapi('TagFrontmatter');
PatternSchema.openapi('PatternFrontmatter');
PracticeSchema.openapi('PracticeFrontmatter');
PrimitiveSchema.openapi('PrimitiveFrontmatter');
ProtocolSchema.openapi('ProtocolFrontmatter');
QuestionSchema.openapi('QuestionFrontmatter');
ArticleSchema.openapi('ArticleFrontmatter');
PersonSchema.openapi('PersonFrontmatter');
GroupSchema.openapi('GroupFrontmatter');
ProjectSchema.openapi('ProjectFrontmatter');
PlaceSchema.openapi('PlaceFrontmatter');
GatheringSchema.openapi('GatheringFrontmatter');

// Storage schemas
R2DocumentSchema.openapi('R2Document');
VectorizeMetadataSchema.openapi('VectorizeMetadata');

// API schemas
ListParamsSchema.openapi('ListParams');
SearchParamsSchema.openapi('SearchParams');
SearchResultSchema.openapi('SearchResult');
RerankResultSchema.openapi('RerankResult');
ErrorResponseSchema.openapi('ErrorResponse');
EntryResponseSchema.openapi('EntryResponse');
EntryListResponseSchema.openapi('EntryListResponse');
SearchResponseSchema.openapi('SearchResponse');

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
