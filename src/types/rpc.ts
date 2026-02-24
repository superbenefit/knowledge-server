/**
 * RPC type definitions for WorkerEntrypoint service binding interface.
 *
 * These types define the contract for inter-Worker RPC calls via service bindings.
 * Consumer apps import these for type-safe method calls:
 *   import type { SearchKnowledgeParams } from 'superbenefit-knowledge-server/types'
 *
 * Spec: tmp/worker-rpc.md v0.17
 */

import type { ContentType } from './content';
import type { SearchResult } from './api';
import type { R2Document } from './storage';

// ---------------------------------------------------------------------------
// Parameter types
// ---------------------------------------------------------------------------

export interface SearchKnowledgeParams {
  query: string;
  contentType?: ContentType;
  group?: string;
  release?: string;
  limit?: number;
}

export interface GetDocumentParams {
  contentType: ContentType;
  id: string;
}

export interface GetDocumentByPathParams {
  path: string;
}

export interface DefineTermParams {
  term: string;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface SearchKnowledgeResult {
  items: SearchResult[];
  total: number;
}

export interface ListGroupsResult {
  groups: Array<{ id: string; title: string; description?: string }>;
}

export interface ListReleasesResult {
  releases: Array<{ id: string; title: string; description?: string }>;
}

export interface DefineTermResult {
  term: string;
  definition: string | null;
}

// Re-export entity types that consumers need
export type { ContentType, SearchResult, R2Document };
