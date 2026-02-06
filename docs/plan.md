# Knowledge Server: Claude Code Implementation Plan

**Version:** 2.7  
**Date:** February 6, 2026  
**Spec Reference:** `spec-v0.12.md`  
**Ontology Reference:** `ontology.md`  
**Access Control Reference:** `porch-spec.md` v0.14

## Overview

This plan outlines a systematic approach to implementing the SuperBenefit knowledge-server infrastructure using Claude Code, optimized for February 2026 tooling and best practices.

**Repository:** `knowledge-server`

**Deliverables:**
- MCP server with porch access control framework (Open tier, Phase 1)
- Public REST API with OpenAPI documentation
- GitHub → R2 → Vectorize sync pipeline
- Two-stage retrieval with ID-based document lookup
- Framework ready for Phases 2-3 (no code changes required to add tiers)

**Execution Model:**
- **Parallel packages** (1-5) run in Claude Code Web as independent PRs
- **Integration** done in local Claude Code with wrangler dev
- See **Parallelization Strategy** section for dependency graph

---

## Phased Architecture Summary

| Phase | Focus | Deliverables | Architecture | Access |
|-------|-------|--------------|--------------|--------|
| **1. Foundation** | Search, retrieval, API | This plan | Stateless `createMcpHandler` | Open tier (no auth) |
| **2. Stateful Services** | AI chat, agents, PRs | Future plan | `AIChatAgent` + AI SDK `tool()` | + Public tier (Access for SaaS) |
| **3. Knowledge Commons** | Multi-DAO federation | Future plan | `Agent` as MCP Client | + Members tier (Hats/token gate) |

**Phase 1 Scope:** Tools, Resources, Prompts — all Open tier, no authentication

---

## Critical Prerequisite: Knowledge Base Ontology

⚠️ **BLOCKING DEPENDENCY**: The knowledge base repository must implement the ontology before content can be synced.

The knowledge server schemas depend on:
1. Directory structure (`artifacts/`, `data/`, `links/`, `tags/`, `notes/`, `drafts/`)
2. Metadata Menu fileClass definitions in `/tools/types/`
3. Required frontmatter fields on content (`group`, `release`, `author`, etc.)

**Status:** Not implemented  
**Location:** `superbenefit/knowledge-base` repository  
**Reference:** `ontology.md` Migration Tasks section (Phases 1-5)

Until the ontology is implemented:
- Sync workflow will have no content to ingest
- Vectorize index will remain empty
- API/MCP tools will return no results

**Recommended approach:**
1. Implement knowledge-server Package 0 (Schemas) first — defines the contract
2. Implement ontology in knowledge-base (can be parallel with Packages 1-5)
3. Complete knowledge-server integration
4. Deploy and test with real content

---

## WaaP Integration (Validated)

**Research Date:** 2026-02-01

WaaP (Wallet as a Protocol) from human.tech/Holonym is validated for the authentication UI in Phase 2+.

### What WaaP Is
- **Frontend wallet SDK** (`@human.tech/waap-sdk`) — runs in browser only
- EIP-1193-compliant interface via `window.waap`
- Supports: wallet (injected), email, phone, social (Google, Twitter, Discord, GitHub)
- 2PC (Two-Party Computation) key management with Ika MPC network
- No seed phrases — recovery via social/biometric/2FA

### What WaaP Does NOT Do
- Does NOT provide server-side authentication
- Does NOT replace SIWE — it provides the wallet that signs SIWE messages
- Has NO backend component for the knowledge-server

### Phase 2 Architecture (Future)

```
┌─────────────────────────────────────────┐
│ UI Client (Browser)                     │
│ - WaaP SDK handles wallet UI            │
│ - User logs in via email/social/wallet  │
│ - Signs SIWE message                    │
└──────────────┬──────────────────────────┘
               │ SIWE auth flow
               ▼
┌─────────────────────────────────────────┐
│ SIWE OIDC IdP (separate Worker)         │
│ - Validates SIWE signature              │
│ - Issues OIDC tokens                    │
│ - Registered in Cloudflare Access       │
└──────────────┬──────────────────────────┘
               │ Access JWT
               ▼
┌─────────────────────────────────────────┐
│ Knowledge Server (Worker)               │
│ - Parses CF-Access-JWT-Assertion header │
│ - Injects authContext into MCP handler  │
│ - resolveAuthContext() → tier           │
└─────────────────────────────────────────┘
```

> **Phase 1 note:** WaaP is not needed for Phase 1. All tools are Open tier. The architecture above documents how auth will flow in Phase 2 via Cloudflare Access for SaaS. See `porch-spec.md` for full details.

---

## Current Progress

- [x] Phase 0: Template scaffolded from `cloudflare/ai/demos/remote-mcp-github-oauth`
- [x] Dependencies installed (hono, viem, @hatsprotocol/sdk-v1-core, etc.)
- [x] TypeScript compiles (`npm run type-check` passes)
- [x] `src/env.d.ts` created for secret type definitions
- [x] Porch spec v0.14 finalized — access control framework defined
- [x] Validation report: all architectural assumptions confirmed against Feb 2026 docs
- [x] Recovery plan: OAuth removal and porch realignment documented
- [ ] ~~Phase 0.5: GitHub OAuth App setup~~ → **Removed** (porch framework eliminates in-Worker OAuth)
- [ ] Package 0: Schemas (v0.12 ontology + porch types)
- [ ] Packages 1-5: Implementation
- [ ] Package 6: Porch Framework + MCP Cleanup
- [ ] Integration
- [ ] **Knowledge base ontology implementation** (external dependency)

---

## Recovery Context: OAuth Removal

> **Background:** The codebase was scaffolded from `remote-mcp-github-oauth` template which includes `OAuthProvider`, GitHub OAuth handler, and related bindings. The porch framework (v0.14) moves authentication to infrastructure layer and eliminates in-Worker OAuth for Phase 1. See `knowledge-server-recovery.md` for detailed change inventory.

### What Gets Removed

| File/Binding | Lines | Reason |
|-------------|-------|--------|
| `src/github-handler.ts` | ~200 | OAuth flow → porch Phase 2 |
| `src/workers-oauth-utils.ts` | ~400 | CSRF, state, dialogs → porch Phase 2 |
| `src/utils.ts` | ~80 | Upstream auth helpers |
| `OAUTH_KV` binding | — | Not needed (authContext injection) |
| `NONCE_KV` binding | — | Not needed until Phase 3 |
| `workers-oauth-provider` dep | — | No longer a runtime dependency |
| `GITHUB_CLIENT_ID` secret | — | OAuth app not used |
| `GITHUB_CLIENT_SECRET` secret | — | OAuth app not used |
| `COOKIE_ENCRYPTION_KEY` secret | — | No session management |

Total: ~680 lines removed, 3 bindings removed, 3 secrets removed.

### What Stays (Dormant for Phase 3)

| File | Purpose |
|------|---------|
| `src/auth/hats.ts` | Hats Protocol role checking |
| `src/auth/ens.ts` | ENS resolution for display |
| `ROLE_CACHE` KV | Cached Hats roles |
| `ENS_CACHE` KV | Cached ENS lookups |
| `MAINNET_RPC_URL` | ENS resolution |
| `OPTIMISM_RPC_URL` | Hats queries |

---

## Parallelization Strategy

This plan supports parallel development using Claude Code Web for isolated modules, with final integration in local Claude Code (IDE/terminal).

### Environment Considerations

| Environment | Best For | Limitations |
|-------------|----------|-------------|
| **CC Web** | Pure TS modules, schemas, logic with mockable deps | No wrangler, no local bindings |
| **CC Local** | Integration, wrangler dev, MCP Inspector, deployment | Linear, slower iteration |

### Work Packages

Execute packages 1-5 in parallel after Package 0 is merged. Package 6 (Porch Framework + MCP Cleanup) follows integration.

```
                    ┌─────────────────┐
                    │   Package 0     │
                    │  Schemas/Types  │
                    │   (do first)    │
                    └────────┬────────┘
                             │ merge to main
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Package 1     │ │   Package 2     │ │   Package 4     │
│   Auth Module   │ │   Retrieval     │ │  Sync Workflow  │
│  (porch types)  │ │    CC Web ✅    │ │    CC Web ✅    │
│    CC Web ✅    │ └────────┬────────┘ └────────┬────────┘
└────────┬────────┘          │                   │
         │          ┌────────┴────────┐          │
         │          ▼                 │          │
         │ ┌─────────────────┐        │          │
         │ │   Package 3     │        │          │
         │ │   REST API      │        │          │
         │ │    CC Web ✅    │        │          │
         │ └────────┬────────┘        │          │
         │          │                 │          │
         │ ┌────────┴────────┐        │          │
         │ ▼                 ▼        ▼          │
         │ ┌─────────────────────────────────────┤
         │ │          Package 5                  │
         │ │       Queue Consumer                │
         │ │          CC Web ✅                  │
         └─┤                                     │
           └──────────────┬──────────────────────┘
                          │ all PRs merged
                          ▼
              ┌───────────────────────┐
              │     Integration       │
              │  MCP Tools + Wiring   │
              │    CC Local only ⚠️   │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │     Package 6         │
              │  Porch Framework +    │
              │  MCP Cleanup          │
              │    CC Web or Local    │
              └───────────────────────┘
```

---

## Package 0: Schemas & Types (BLOCKING)

**Branch:** `feat/schemas`  
**Environment:** Either  
**Must complete first** — defines contracts for all other packages.

### Files to Create

```
src/types/
├── index.ts       # Re-exports all types
├── content.ts     # Content schemas per ontology
├── storage.ts     # R2Document, VectorMetadata, ID helpers
├── auth.ts        # Porch framework types (AccessTier, AuthContext, etc.)
└── api.ts         # API request/response types
```

### content.ts — Content Model (v0.12)

```typescript
import { z } from 'zod';

// Content type enum — all 20 types from ontology
export const ContentTypeSchema = z.enum([
  'file',
  'reference', 'index', 'link', 'tag',
  'resource', 'pattern', 'practice', 'primitive', 'protocol', 'playbook', 'question',
  'story', 'study', 'article',
  'data', 'person', 'group', 'project', 'place', 'gathering'
]);

export type ContentType = z.infer<typeof ContentTypeSchema>;

// Parent type groupings
export const RESOURCE_TYPES: ContentType[] = [
  'pattern', 'practice', 'primitive', 'protocol', 'playbook', 'question'
];
export const STORY_TYPES: ContentType[] = ['study', 'article'];
export const REFERENCE_TYPES: ContentType[] = ['index', 'link', 'tag'];
export const DATA_TYPES: ContentType[] = [
  'person', 'group', 'project', 'place', 'gathering'
];

// Path → Type mapping
export const PATH_TYPE_MAP: Record<string, ContentType> = {
  'artifacts/patterns': 'pattern',
  'artifacts/practices': 'practice',
  'artifacts/primitives': 'primitive',
  'artifacts/protocols': 'protocol',
  'artifacts/playbooks': 'playbook',
  'artifacts/questions': 'question',
  'artifacts/studies': 'study',
  'artifacts/articles': 'article',
  'data/people': 'person',
  'data/groups': 'group',
  'data/projects': 'project',
  'data/places': 'place',
  'data/gatherings': 'gathering',
  'links': 'link',
  'tags': 'tag',
  'notes': 'file',
  'drafts': 'file',
};

export function inferContentType(path: string): ContentType {
  for (const [prefix, type] of Object.entries(PATH_TYPE_MAP)) {
    if (path.startsWith(prefix)) return type;
  }
  return 'file';
}

// FileSchema — base for all types (v0.12 fields)
export const FileSchema = z.object({
  type: ContentTypeSchema.optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  date: z.coerce.date(),
  publish: z.boolean().default(false),
  draft: z.boolean().default(false),
  permalink: z.string().optional(),
  author: z.array(z.string()).optional(),
  group: z.string().optional(),
});

// Parent schemas
export const ReferenceSchema = FileSchema;
export const ResourceSchema = FileSchema.extend({
  release: z.string().optional(),
  hasPart: z.array(z.string()).optional(),
  isPartOf: z.array(z.string()).optional(),
});
export const StorySchema = FileSchema.extend({
  release: z.string().optional(),
});
export const DataSchema = FileSchema;

// ... concrete type schemas per spec section 3.6
```

### storage.ts — ID-Based Retrieval Pattern

```typescript
import { ContentType } from './content';

export interface R2Document {
  id: string;
  contentType: ContentType;
  path: string;
  metadata: Record<string, any>;
  content: string;
  syncedAt: string;
  commitSha: string;
}

export interface VectorMetadata {
  // Indexed fields (used for filtering) — ~200 bytes
  contentType: string;
  group: string;
  tags: string;
  release: string;
  status: string;
  date: number;
  
  // Non-indexed fields (for retrieval/reranking) — ~8800 bytes
  path: string;
  title: string;
  description: string;
  content: string;
}

export const VECTORIZE_LIMITS = {
  METADATA_MAX_BYTES: 10 * 1024,
  VECTOR_ID_MAX_BYTES: 64,
  STRING_INDEX_MAX_BYTES: 64,
  TOP_K_WITH_METADATA: 20,
  TOP_K_WITHOUT_METADATA: 100,
  MAX_METADATA_INDEXES: 10,
} as const;

const MAX_CONTENT_LENGTH = 8000;

export function truncateForMetadata(content: string): string {
  if (content.length <= MAX_CONTENT_LENGTH) return content;
  const truncated = content.slice(0, MAX_CONTENT_LENGTH);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.slice(0, lastSpace) + '...';
}

export function generateId(path: string): string {
  const filename = path.split('/').pop() || path;
  const id = filename.replace(/\.md$/, '');
  if (new TextEncoder().encode(id).length > VECTORIZE_LIMITS.VECTOR_ID_MAX_BYTES) {
    throw new Error(`ID exceeds 64 byte limit: ${id}`);
  }
  return id;
}

export function toR2Key(contentType: ContentType, id: string): string {
  return `content/${contentType}/${id}.json`;
}

export function extractIdFromKey(key: string): string {
  const parts = key.split('/');
  const filename = parts[parts.length - 1];
  return filename.replace(/\.json$/, '');
}

export function extractContentTypeFromKey(key: string): ContentType {
  const parts = key.split('/');
  return parts[1] as ContentType;
}
```

### auth.ts — Porch Framework Types (v0.12)

```typescript
/**
 * Porch access control framework types.
 * See porch-spec.md v0.14 for full specification.
 *
 * Phase 1: Only 'open' tier active
 * Phase 2: + 'public' tier via Access for SaaS
 * Phase 3: + 'members' tier via Hats/token gate
 */

export type AccessTier = 'open' | 'public' | 'members';

export const TIER_LEVEL: Record<AccessTier, number> = {
  open: 0,
  public: 1,
  members: 2,
};

export interface Identity {
  userId: string;
  name: string | null;
  email: string | null;
  provider: string;    // "github" | "siwe"
}

export interface AuthContext {
  identity: Identity | null;
  tier: AccessTier;
  address: `0x${string}` | null;
  roles: HatsRole | null;
}

export interface HatsRole {
  hats: bigint[];
  isMember: boolean;
  isContributor: boolean;
}

// Hats Protocol configuration (dormant until Phase 3)
export const HATS_CONFIG = {
  chain: 'optimism' as const,
  chainId: 10,
  contract: '0x3bc1A0Ad72417f2d411118085256fC53CBdDd137' as const,
  treeId: 30,
  paths: {
    contributor: [3, 1] as const,
    member: [3, 5] as const,
  },
} as const;
```

### CC Web Kickoff Prompt

```
I'm implementing Package 0 (Schemas) for the SuperBenefit knowledge-server.

Reference: spec-v0.12.md Sections 2-4

Create src/types/ with:

1. content.ts:
   - ContentTypeSchema enum (20 types from ontology)
   - RESOURCE_TYPES, STORY_TYPES, REFERENCE_TYPES, DATA_TYPES arrays
   - PATH_TYPE_MAP for directory → type inference
   - inferContentType() helper
   - FileSchema (base) with v0.12 fields
   - Parent schemas: ReferenceSchema, ResourceSchema, StorySchema, DataSchema
   - Concrete type schemas for all 16 leaf types
   - ContentSchema discriminated union

2. storage.ts:
   - R2Document interface
   - VectorMetadata interface (indexed + non-indexed fields)
   - VECTORIZE_LIMITS constants
   - truncateForMetadata, generateId, toR2Key, extractIdFromKey, extractContentTypeFromKey

3. auth.ts:
   - AccessTier: 'open' | 'public' | 'members' (porch framework)
   - TIER_LEVEL constants
   - Identity interface (userId, name, email, provider)
   - AuthContext interface (identity, tier, address, roles)
   - HatsRole interface (hats, isMember, isContributor)
   - HATS_CONFIG constants

4. api.ts:
   - SearchFilters, SearchResult, RerankResult
   - ListEntriesResponse, SearchResponse schemas

5. index.ts: re-exports

The ontology document defines the full type hierarchy and fields.
```

---

## Package 1: Auth Module

**Branch:** `feat/auth`  
**Environment:** CC Web ✅  
**Dependencies:** Package 0

> **Scope change in v2.7**: OAuth files removed. This package now focuses on porch framework files + dormant auth utilities for Phase 3.

```
src/auth/
├── resolve.ts     # resolveAuthContext() — porch framework core
├── check.ts       # checkTierAccess() — tier comparison
├── hats.ts        # Hats Protocol role checking (dormant)
├── ens.ts         # ENS resolution (dormant)
└── index.ts       # Exports
```

### resolve.ts — Porch Framework Core

```typescript
import { getMcpAuthContext } from 'agents/mcp';
import type { AuthContext, Identity } from '../types/auth';

/**
 * Resolve access context from the current request.
 *
 * Phase 1: Always returns { tier: 'open', identity: null }
 * Phase 2: Extracts identity from getMcpAuthContext() (populated by
 *          Access JWT injection via createMcpHandler's authContext option),
 *          returns 'public' after sybil/agreement checks
 * Phase 3: Checks Hats/tokens/org membership, returns 'members' if authorized
 *
 * This function is the ONLY place tier resolution logic lives.
 * Tools never resolve tiers themselves.
 */
export async function resolveAuthContext(env: Env): Promise<AuthContext> {
  // --- Phase 2: Authentication ---
  // const mcpAuth = getMcpAuthContext();
  // if (!mcpAuth?.props?.sub) {
  //   return { identity: null, tier: 'open', address: null, roles: null };
  // }
  //
  // const identity: Identity = {
  //   userId: mcpAuth.props.sub as string,
  //   name: (mcpAuth.props.name as string) ?? null,
  //   email: (mcpAuth.props.email as string) ?? null,
  //   provider: (mcpAuth.props.provider as string) ?? 'unknown',
  // };
  //
  // --- Phase 3: Authorization ---
  // const address = await env.IDENTITY_MAP.get(identity.userId);
  // if (address) {
  //   const roles = await checkHatsRoles(address, env);
  //   if (roles.isMember || roles.isContributor) {
  //     return { identity, tier: 'members', address, roles };
  //   }
  // }
  //
  // return { identity, tier: 'public', address: null, roles: null };

  // Phase 1: Open tier only — no authentication
  return { identity: null, tier: 'open', address: null, roles: null };
}
```

### check.ts — Tier Checking

```typescript
import type { AccessTier, AuthContext } from '../types/auth';
import { TIER_LEVEL } from '../types/auth';

export function checkTierAccess(
  requiredTier: AccessTier,
  authContext: AuthContext
): { allowed: true; authContext: AuthContext } | { allowed: false; requiredTier: AccessTier; currentTier: AccessTier } {
  if (TIER_LEVEL[authContext.tier] >= TIER_LEVEL[requiredTier]) {
    return { allowed: true, authContext };
  }
  return { allowed: false, requiredTier, currentTier: authContext.tier };
}
```

### CC Web Kickoff Prompt

```
I'm implementing Package 1 (Auth Module) for the SuperBenefit knowledge-server.

Reference: spec-v0.12.md Section 2, porch-spec.md v0.14

This implements the porch access control framework for Phase 1 (Open tier only).
There is NO OAuth, NO SIWE verification, NO token management in Phase 1.

Create src/auth/ with:

1. resolve.ts:
   - resolveAuthContext(env): Promise<AuthContext>
   - Phase 1: always returns { tier: 'open', identity: null, address: null, roles: null }
   - Contains commented Phase 2/3 logic as documented architecture
   - Import getMcpAuthContext from 'agents/mcp' (commented until Phase 2)

2. check.ts:
   - checkTierAccess(requiredTier, authContext): result
   - Returns { allowed: true, authContext } or { allowed: false, requiredTier, currentTier }

3. hats.ts (dormant — kept for Phase 3):
   - checkHatsRoles(address, deps): Promise<HatsRole>
   - Use @hatsprotocol/sdk-v1-core for treeIdToHatId
   - Cache results in ROLE_CACHE KV (5 min TTL)

4. ens.ts (dormant — kept for Phase 3):
   - resolveENS(address, deps): Promise<{ name?, avatar? }>
   - Cache results in ENS_CACHE KV (1 hour TTL)

5. index.ts: exports resolveAuthContext, checkTierAccess, and dormant utilities

Import types from src/types/auth.ts.
```

---

## Package 2: Retrieval Module

**Branch:** `feat/retrieval`  
**Environment:** CC Web ✅  
**Dependencies:** Package 0

```
src/retrieval/
├── embed.ts       # Embedding generation
├── search.ts      # Vectorize search with filters
├── rerank.ts      # Reranking with bge-reranker-base
├── fetch.ts       # R2 document fetching
├── cache.ts       # Cache key generation
└── index.ts       # searchKnowledge() orchestrator
```

### Key Pattern: ID-Based Retrieval

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. VECTOR SEARCH                                                        │
│    Query → Embed → Vectorize.query(filter, topK: 20)                   │
│    Returns: 20 matches with metadata (including content snippet)        │
│    Vector ID = Document ID (e.g., "cell-governance")                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. RERANK                                                               │
│    Query + metadata.content → bge-reranker-base → top 5                │
│    Uses content snippet from metadata (NO R2 fetch needed)              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. DOCUMENT FETCH (only for final results)                              │
│    top 5 IDs → R2.get(metadata.path) → full documents                  │
│    Parallel fetches using metadata.path field                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### CC Web Kickoff Prompt

```
I'm implementing Package 2 (Retrieval Module) for the SuperBenefit knowledge-server.

Reference: spec-v0.12.md Section 6 (Retrieval System)

This implements the ID-based retrieval pattern:
- Vector ID = Document ID (e.g., "cell-governance")
- metadata.path = R2 object key for document fetch
- metadata.content = truncated body for reranking (NO R2 fetch during rerank!)

Create src/retrieval/ with:

1. embed.ts:
   - generateEmbedding(text, deps): Promise<number[]>
   - Use @cf/baai/bge-base-en-v1.5

2. search.ts:
   - searchWithFilters(query, filters, deps): Promise<VectorizeMatch[]>
   - Vectorize filter on: contentType, group, release, status, tags
   - topK: 20 with returnMetadata: 'all'
   - IMPORTANT: 20 is max when returning metadata

3. rerank.ts:
   - rerankResults(query, matches, deps): Promise<RerankResult[]>
   - CRITICAL: Use batch API pattern (single call with contexts array)
   - Extract content from metadata.content (NO R2 fetch needed!)
   - Use @cf/baai/bge-reranker-base
   - Cache results in RERANK_CACHE (1 hour TTL)

4. fetch.ts:
   - getDocuments(results, deps): Promise<R2Document[]>
   - getDocument(contentType, id, deps): Promise<R2Document | null>

5. cache.ts:
   - hashQuery(query, ids): string

6. index.ts:
   - searchKnowledge(query, filters, options, deps): Promise<SearchResult[]>

Functions accept deps as params for testability.
Import types from src/types/.
```

---

## Package 3: REST API Routes

**Branch:** `feat/rest-api`  
**Environment:** CC Web ✅  
**Dependencies:** Package 0, Package 2 interface (can stub)

```
src/api/
├── schemas.ts     # Zod + OpenAPI schemas
├── routes.ts      # Hono OpenAPI route definitions
├── handlers/
│   ├── entries.ts
│   └── search.ts
└── index.ts       # Hono app with CORS
```

### CC Web Kickoff Prompt

```
I'm implementing Package 3 (REST API) for the SuperBenefit knowledge-server.

Reference: spec-v0.12.md Section 8 (Public REST API)

Create src/api/ with:

1. schemas.ts:
   - ListEntriesQuerySchema, SearchQuerySchema
   - ListEntriesResponseSchema, SearchResponseSchema
   - R2DocumentSchema (for single entry response)

2. routes.ts:
   - OpenAPIHono app with CORS (origin: '*', methods: GET/HEAD/OPTIONS)
   - GET /entries — list/filter entries
   - GET /entries/{contentType}/{id} — single entry
   - GET /search — semantic search
   - GET /openapi.json — OpenAPI spec
   - Cache headers: max-age=300, stale-while-revalidate=3600

3. handlers/entries.ts, handlers/search.ts

4. index.ts: Export configured api router

Use @hono/zod-openapi for route definitions.
Import types from src/types/.
```

---

## Package 4: Sync Workflow

**Branch:** `feat/sync-workflow`  
**Environment:** CC Web ✅  
**Dependencies:** Package 0

```
src/sync/
├── workflow.ts    # KnowledgeSyncWorkflow class
├── parser.ts      # parseMarkdown, extractFrontmatter
├── transform.ts   # content normalization, ID generation
└── github.ts      # fetchFileContent, verifyWebhookSignature
```

### CC Web Kickoff Prompt

```
I'm implementing Package 4 (Sync Workflow) for the SuperBenefit knowledge-server.

Reference: spec-v0.12.md Section 5 (Sync Layer)

Create src/sync/ with:

1. workflow.ts:
   - KnowledgeSyncWorkflow extends WorkflowEntrypoint
   - Process changedFiles: fetch from GitHub, parse, store to R2
   - Process deletedFiles: remove from R2
   - CRITICAL: Only sync publish:true AND draft:false content
   - Use NonRetryableError for 404s
   - Retry config: limit 5, delay 30s, exponential backoff

2. parser.ts:
   - parseMarkdown(content: string): { frontmatter, body }

3. transform.ts:
   - normalizeContent(parsed, path): R2Document

4. github.ts:
   - verifyWebhookSignature(body, signature, secret): boolean
   - fetchFileContent(path, commitSha, token): Promise<string>

Import types from src/types/.
```

---

## Package 5: Queue Consumer

**Branch:** `feat/queue-consumer`  
**Environment:** CC Web ✅  
**Dependencies:** Package 0

```
src/consumers/
├── vectorize.ts   # updateVectorize, deleteFromVectorize
├── cache.ts       # invalidateCache
└── handler.ts     # queue handler with per-message ack
```

### CC Web Kickoff Prompt

```
I'm implementing Package 5 (Queue Consumer) for the SuperBenefit knowledge-server.

Reference: spec-v0.12.md Sections 4-5

Create src/consumers/ with:

1. vectorize.ts:
   - updateVectorize(doc: R2Document, deps): Promise<void>
   - deleteFromVectorize(id, deps): Promise<void>
   - CRITICAL: Use truncateForMetadata() for content field
   - CRITICAL: metadata.path = toR2Key(contentType, id)

2. cache.ts:
   - invalidateCache(doc: R2Document, cache: KVNamespace): Promise<void>

3. handler.ts:
   - CRITICAL: Use per-message msg.ack(), NOT batch.ackAll()
   - Only process content/ prefix objects
   - Handle object-create and object-delete events

Import types from src/types/.
```

---

## Package 6: Porch Framework + MCP Cleanup

**Branch:** `feat/porch-framework`  
**Environment:** CC Web or CC Local  
**Dependencies:** Integration complete

> **Scope change in v2.7**: Previously "MCP Resources & Prompts". Now includes OAuth removal, porch framework wiring, and routing split. Resources and prompts code (from v2.6) is preserved.

### Files to Create/Update

```
src/mcp/
├── server.ts      # McpServer setup + createMcpHandler (update)
├── tools.ts       # Tool registrations with porch tier checking (update)
├── resources.ts   # Resource registrations (keep from v2.6)
├── prompts.ts     # Prompt registrations (keep from v2.6)
└── index.ts       # Exports (update)

src/auth/
├── resolve.ts     # resolveAuthContext() (from Package 1)
├── check.ts       # checkTierAccess() (from Package 1)
└── ...            # existing auth files

src/
├── index.ts       # Routing split: MCP direct, REST through Hono (update)
└── env.d.ts       # Remove OAuth bindings (update)
```

### Files to Delete

```
src/github-handler.ts         # OAuth flow
src/workers-oauth-utils.ts    # CSRF, state, approval
src/utils.ts                  # Upstream auth helpers
```

### MCP Server (Updated)

```typescript
// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";

export function createKnowledgeServer(env: Env) {
  const server = new McpServer({
    name: "superbenefit-knowledge",
    version: "1.0.0",
  });

  registerTools(server, env);
  registerResources(server, env);
  registerPrompts(server, env);

  return server;
}

export const McpHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const server = createKnowledgeServer(env);
    const handler = createMcpHandler(server, {
      route: '/mcp',
      corsOptions: { origin: '*' },
      // Phase 2: authContext injected here from Access JWT
    });
    return handler(request, env, ctx);
  },
};
```

### Tool Pattern (Porch Framework)

```typescript
// src/mcp/tools.ts — every tool uses this pattern
import { resolveAuthContext } from '../auth/resolve';
import { checkTierAccess } from '../auth/check';

server.tool('search_knowledge', 'Search the knowledge base', { query: z.string(), ... },
  async ({ query, filters }) => {
    const authContext = await resolveAuthContext(env);
    const access = checkTierAccess('open', authContext);
    if (!access.allowed) {
      return { content: [{ type: 'text', text: `Requires ${access.requiredTier} access.` }], isError: true };
    }
    const results = await searchKnowledge(query, filters || {}, {}, env);
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  }
);
```

### Router Integration (Option B: Routing Split)

```typescript
// src/index.ts
import { Hono } from 'hono';
import { api } from './api/routes';
import { McpHandler } from './mcp';
import { handleVectorizeQueue } from './consumers/vectorize';

export { KnowledgeSyncWorkflow } from './sync/workflow';

const app = new Hono<{ Bindings: Env }>();

// Public REST API
app.route('/api/v1', api);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    
    // MCP server — direct to handler, bypassing Hono
    if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) {
      return McpHandler.fetch(request, env, ctx);
    }
    
    // GitHub webhook
    if (url.pathname === '/webhook' && request.method === 'POST') {
      return handleWebhook(request, env);
    }
    
    // Everything else through Hono (REST API, health checks)
    return app.fetch(request, env, ctx);
  },
  queue: handleVectorizeQueue,
};
```

### CC Web Kickoff Prompt

```
I'm implementing Package 6 (Porch Framework + MCP Cleanup) for the SuperBenefit knowledge-server.

Reference: spec-v0.12.md Sections 2 and 7, porch-spec.md v0.14, knowledge-server-recovery.md

This package:
1. Removes OAuth files (github-handler.ts, workers-oauth-utils.ts, utils.ts)
2. Updates tools to use resolveAuthContext() + checkTierAccess() pattern
3. Updates server.ts to remove OAuthProvider wrapping
4. Updates index.ts to routing split (MCP direct, REST through Hono)
5. Updates env.d.ts to remove OAuth bindings
6. Updates wrangler.jsonc to remove OAUTH_KV, NONCE_KV
7. Preserves resources.ts and prompts.ts (already implemented)

Key changes:
- OLD: OAuthProvider wraps McpHandler, Hono routes /mcp/*, /authorize, /token
- NEW: MCP requests go direct to handler, REST through Hono, no OAuthProvider
- OLD: requireTier() wrapper reads context.props
- NEW: resolveAuthContext() + checkTierAccess() per porch-spec.md
- OLD: AccessTier = 'public' | 'member' | 'vibecoder'
- NEW: AccessTier = 'open' | 'public' | 'members'

All tools require 'open' tier for Phase 1.
```

---

## Integration (Local Only)

**Branch:** `main` or `feat/integration`  
**Environment:** CC Local ⚠️  
**Dependencies:** All packages merged

Tasks:
- Wire `src/index.ts` router (routing split: MCP direct, REST through Hono)
- Implement `src/mcp/server.ts` with createMcpHandler (no OAuthProvider)
- Implement `src/mcp/tools.ts` with porch tier checking
- Update `wrangler.jsonc` with actual binding IDs
- Test with `wrangler dev` + MCP Inspector (no auth needed!)
- Test REST API with curl
- Deploy

### Routing Split Pattern

```
Request → fetch handler
  ├── /mcp, /mcp/*   → McpHandler.fetch() (direct, bypasses Hono)
  ├── /webhook POST   → handleWebhook() (GitHub sync)
  └── everything else → Hono app (REST API, health checks)
```

**Why routing split?** MCP's Streamable HTTP protocol has specific requirements around session management and streaming that can conflict with Hono middleware (CORS, body parsing, etc.). Routing MCP requests directly to `createMcpHandler` avoids these issues while REST routes benefit from Hono's middleware stack.

---

## Infrastructure Setup

### Create Resources (run once)

```bash
# Create R2 bucket
npx wrangler r2 bucket create superbenefit-knowledge

# Create Vectorize index
npx wrangler vectorize create superbenefit-knowledge-idx \
  --dimensions=768 --metric=cosine

# CRITICAL: Create metadata indexes BEFORE inserting vectors
npx wrangler vectorize create-metadata-index superbenefit-knowledge-idx \
  --property-name=contentType --type=string
npx wrangler vectorize create-metadata-index superbenefit-knowledge-idx \
  --property-name=group --type=string
npx wrangler vectorize create-metadata-index superbenefit-knowledge-idx \
  --property-name=tags --type=string
npx wrangler vectorize create-metadata-index superbenefit-knowledge-idx \
  --property-name=release --type=string
npx wrangler vectorize create-metadata-index superbenefit-knowledge-idx \
  --property-name=status --type=string
npx wrangler vectorize create-metadata-index superbenefit-knowledge-idx \
  --property-name=date --type=number

# Create Queue
npx wrangler queues create superbenefit-knowledge-sync

# Create KV namespaces (active)
npx wrangler kv:namespace create RERANK_CACHE
npx wrangler kv:namespace create SYNC_STATE

# Create KV namespaces (dormant — Phase 3)
npx wrangler kv:namespace create ROLE_CACHE
npx wrangler kv:namespace create ENS_CACHE

# Configure R2 event notifications
npx wrangler r2 bucket notification create superbenefit-knowledge \
  --event-type object-create --event-type object-delete \
  --queue superbenefit-knowledge-sync \
  --prefix content/
```

> **Removed in v2.7**: `OAUTH_KV` and `NONCE_KV` creation commands. See recovery plan for dashboard cleanup of existing namespaces.

---

## Testing Strategy

### Local Testing

```bash
# Terminal 1: Start server (no auth config needed!)
npm run dev

# Terminal 2: MCP Inspector
npx @modelcontextprotocol/inspector
# Connect to http://localhost:8788/mcp
```

> **Simplified in v2.7**: No `.dev.vars` needed for OAuth credentials. No GitHub OAuth App setup. `wrangler dev` works immediately for MCP and REST endpoints.

### REST API Testing

```bash
# List entries
curl http://localhost:8788/api/v1/entries

# Get single entry
curl http://localhost:8788/api/v1/entries/pattern/cell-governance

# Search
curl "http://localhost:8788/api/v1/search?q=governance"

# OpenAPI spec
curl http://localhost:8788/api/v1/openapi.json
```

### CORS Testing

```javascript
// Browser console
fetch('http://localhost:8788/api/v1/entries')
  .then(r => r.json())
  .then(console.log);
```

### MCP Client Testing

| Client | Priority | Connection |
|--------|----------|------------|
| MCP Inspector | High (dev) | `npx @modelcontextprotocol/inspector` |
| Workers AI Playground | High (CF) | playground.ai.cloudflare.com |
| Claude Desktop | High (Anthropic) | Via mcp-remote proxy |
| Cursor | Medium | Native URL config |
| VS Code | Medium | MCP config |

---

## Deployment Checklist

1. [ ] All packages merged to main
2. [ ] OAuth files deleted (github-handler.ts, workers-oauth-utils.ts, utils.ts)
3. [ ] `wrangler.jsonc` has actual binding IDs (no OAUTH_KV, no NONCE_KV)
4. [ ] Active secrets configured: `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET`
5. [ ] Removed secrets: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `COOKIE_ENCRYPTION_KEY`
6. [ ] Vectorize metadata indexes created
7. [ ] R2 event notifications configured
8. [ ] GitHub webhook pointing to deployed URL
9. [ ] Deploy: `npm run deploy`
10. [ ] Verify: MCP Inspector connects (no auth)
11. [ ] Verify: REST API responds
12. [ ] Verify: `resolveAuthContext()` returns `{ tier: 'open' }`
13. [ ] Trigger sync: push to knowledge-base
14. [ ] Dashboard cleanup: delete unused KV namespaces (see recovery plan)

---

## Future Phases Reference

### Phase 2: Stateful Services + Public Tier

**When to implement:** After Phase 1 is stable and you need:
- AI chat interfaces with persistent history
- Human-in-the-loop approval for write operations
- Authenticated user features (personalized, rate-limited)

**Architecture:** `AIChatAgent` + AI SDK `tool()` with `needsApproval`

**Porch additions:**
- Register knowledge server in Cloudflare Access for SaaS
- Configure GitHub + SIWE as IdPs in Access
- Add middleware to parse `CF-Access-JWT-Assertion` → inject `authContext`
- Uncomment Phase 2 block in `resolveAuthContext()`
- Optionally register in MCP Server Portal

**Key additions:**
- Durable Object binding for agent state
- React client with `useAgentChat()` hook
- GitHub API integration for PRs
- `CF_ACCESS_AUD` binding
- `SYBIL_CACHE`, `AGREEMENTS` KV namespaces

### Phase 3: Knowledge Commons + Members Tier

**When to implement:** After Phase 2 and you want:
- Cross-DAO knowledge federation
- Partner MCP server connections
- Member-only tools (governance, write operations)

**Architecture:** `Agent` as MCP Client with `addMcpServer()`

**Porch additions:**
- Uncomment Phase 3 block in `resolveAuthContext()`
- `IDENTITY_MAP` KV for GitHub→wallet mapping
- `HATS_SUBGRAPH_URL` for subgraph queries
- Activate dormant `hats.ts`, `ens.ts`, `ROLE_CACHE`, `ENS_CACHE`

---

## Dependencies (v0.12)

```json
{
  "dependencies": {
    "@hatsprotocol/sdk-v1-core": "^0.10.0",
    "@hono/zod-openapi": "^0.15.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "agents": "^0.3.0",
    "hono": "^4.0.0",
    "viem": "^2.21.0",
    "yaml": "^2.3.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250101.0",
    "typescript": "^5.5.0",
    "wrangler": "^3.60.0"
  }
}
```

> **Removed in v2.7**: `workers-oauth-provider` — no longer a Worker dependency. Phase 2 auth handled by Cloudflare Access for SaaS at the infrastructure layer.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.7 | 2026-02-06 | Porch framework: replaced OAuthProvider with authContext injection, new tier model (open/public/members), routing split (MCP direct, REST through Hono), removed Phase 0.5 OAuth setup, removed OAUTH_KV/NONCE_KV, removed workers-oauth-provider, updated Package 1 (auth → porch framework), updated Package 6 (porch cleanup), added recovery context, simplified testing (no auth config needed) |
| 2.6 | 2026-02-01 | MCP patterns: stateless createMcpHandler, permission wrapper, Package 6 (Resources/Prompts), phased architecture summary, future phases reference, updated dependencies |
| 2.5 | 2026-02-01 | ID-based retrieval: storage.ts types, fetch.ts module, updated vectorize consumer |
| 2.4 | 2026-02-01 | Ontology alignment: Package 0 content model, v0.9 schema updates |
| 2.3 | 2026-01-30 | Initial parallelization strategy, CC Web kickoff prompts |