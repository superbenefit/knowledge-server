// Content model (spec section 3)
export {
  ContentTypeSchema,
  RESOURCE_TYPES,
  STORY_TYPES,
  REFERENCE_TYPES,
  DATA_TYPES,
  PATH_TYPE_MAP,
  inferContentType,
  // Base schema
  FileSchema,
  // Parent schemas
  ReferenceSchema,
  ResourceSchema,
  StorySchema,
  DataSchema,
  // Reference type schemas
  LinkSchema,
  TagSchema,
  // Resource type schemas
  PatternSchema,
  PracticeSchema,
  PrimitiveSchema,
  ProtocolSchema,
  PlaybookSchema,
  QuestionSchema,
  // Story type schemas
  StudySchema,
  ArticleSchema,
  // Data type schemas
  PersonSchema,
  GroupSchema,
  ProjectSchema,
  PlaceSchema,
  GatheringSchema,
  // Discriminated union
  ContentSchema,
} from './content';
export type {
  ContentType,
  FileFrontmatter,
  ResourceFrontmatter,
  StoryFrontmatter,
  LinkFrontmatter,
  TagFrontmatter,
  PatternFrontmatter,
  PracticeFrontmatter,
  PrimitiveFrontmatter,
  ProtocolFrontmatter,
  QuestionFrontmatter,
  ArticleFrontmatter,
  PersonFrontmatter,
  GroupFrontmatter,
  ProjectFrontmatter,
  PlaceFrontmatter,
  GatheringFrontmatter,
  Content,
} from './content';

// Auth — porch access control framework (spec section 2)
export {
  AccessTierSchema,
  TIER_LEVEL,
  IdentitySchema,
  AuthContextSchema,
} from './auth';
export type { AccessTier, Identity, AuthContext } from './auth';

// API (spec sections 6, 8)
export {
  SearchFiltersSchema,
  ListParamsSchema,
  SearchParamsSchema,
  SearchResultSchema,
  RerankResultSchema,
  ErrorResponseSchema,
  EntryResponseSchema,
  EntryListResponseSchema,
  SearchResponseSchema,
} from './api';
export type {
  SearchFilters,
  ListParams,
  SearchParams,
  SearchResult,
  RerankResult,
  ErrorResponse,
} from './api';

// Storage (spec section 4)
export {
  VECTORIZE_LIMITS,
  VECTORIZE_NAMESPACE,
  R2DocumentSchema,
  VectorizeMetadataSchema,
  truncateForMetadata,
  generateId,
  toR2Key,
  extractIdFromKey,
  extractContentTypeFromKey,
} from './storage';
export type { R2Document, VectorizeMetadata } from './storage';

// Sync (spec section 5)
export { SyncParamsSchema } from './sync';
export type { SyncParams, R2EventNotification, GitHubPushEvent, ParsedMarkdown } from './sync';
