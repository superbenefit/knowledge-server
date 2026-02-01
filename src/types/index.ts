// Content model
export {
  ContentTypeSchema,
  BaseSchema,
  ArtifactSchema,
  TagSchema,
  ContentEntrySchema,
  ARTIFACT_TYPES,
  REFERENCE_TYPES,
  PATH_TYPE_MAP,
} from './content';
export type {
  ContentType,
  BaseFrontmatter,
  ArtifactFrontmatter,
  TagFrontmatter,
  ContentEntry,
} from './content';

// Auth
export {
  AccessTierSchema,
  HatsRoleSchema,
  AuthPropsSchema,
  HATS_CONFIG,
  TIER_TOOLS,
} from './auth';
export type { AccessTier, HatsRole, AuthProps } from './auth';

// API
export {
  ListParamsSchema,
  SearchParamsSchema,
  PaginationMetaSchema,
  SearchResultSchema,
  ErrorResponseSchema,
  EntryResponseSchema,
  EntryListResponseSchema,
  SearchResponseSchema,
} from './api';
export type {
  ListParams,
  SearchParams,
  PaginationMeta,
  SearchResult,
  ErrorResponse,
} from './api';

// Storage
export {
  R2DocumentSchema,
  VectorizeMetadataSchema,
  R2_KEYS,
} from './storage';
export type { R2Document, VectorizeMetadata } from './storage';

// Sync
export {
  SyncParamsSchema,
  R2EventNotificationSchema,
  SyncStatusSchema,
} from './sync';
export type { SyncParams, R2EventNotification, SyncStatus } from './sync';

// MCP tool inputs
export {
  SearchKnowledgeInputSchema,
  DefineTermInputSchema,
  SearchLexiconInputSchema,
  GetDocumentInputSchema,
  AddTermInputSchema,
  SaveLinkInputSchema,
  UpdateTermInputSchema,
} from './mcp';
export type {
  SearchKnowledgeInput,
  DefineTermInput,
  SearchLexiconInput,
  GetDocumentInput,
  AddTermInput,
  SaveLinkInput,
  UpdateTermInput,
} from './mcp';
