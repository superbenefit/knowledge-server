# Knowledge Server: Claude Code Implementation Plan

**Version:** 2.6  
**Date:** February 1, 2026  
**Spec Reference:** `spec-v0.11.md`  
**Ontology Reference:** `ontology.md`

## Overview

This plan outlines a systematic approach to implementing the SuperBenefit knowledge-server infrastructure using Claude Code, optimized for February 2026 tooling and best practices.

**Repository:** `knowledge-server`

**Deliverables:**
- MCP server with SIWE authentication and Hats authorization
- Public REST API with OpenAPI documentation
- GitHub → R2 → Vectorize sync pipeline
- Two-stage retrieval with ID-based document lookup

**Execution Model:**
- **Parallel packages** (1-5) run in Claude Code Web as independent PRs
- **Integration** done in local Claude Code with wrangler dev
- See **Parallelization Strategy** section for dependency graph

---

## Phased Architecture Summary

| Phase | Focus | Deliverables | Architecture |
|-------|-------|--------------|--------------|
| **1. Foundation** | Search, retrieval, API | This plan | Stateless `createMcpHandler` |
| **2. Stateful Services** | AI chat, agents, PRs | Future plan | `AIChatAgent` + AI SDK `tool()` |
| **3. Knowledge Commons** | Multi-DAO federation | Future plan | `Agent` as MCP Client |

**Phase 1 Scope:** Tools, Resources, Prompts

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

WaaP (Wallet as a Protocol) from human.tech/Holonym is validated for the authentication UI.

### What WaaP Is
- **Frontend wallet SDK** (`@human.tech/waap-sdk`) — runs in browser only
- EIP-1193-compliant interface via `window.waap`
- Supports: wallet (injected), email, phone, social (Google, Twitter, Discord, GitHub)
- 2PC (Two-Party Computation) key management with Ika MPC network
- No seed phrases — recovery via social/biometric/2FA
- Gas sponsorship ("Gas Tank") for gasless transactions
- Independently audited by Cure53, Hexens, Least Authority, Halborn

### What WaaP Does NOT Do
- Does NOT provide server-side authentication
- Does NOT replace SIWE — it provides the wallet that signs SIWE messages
- Has NO backend component for the knowledge-server

### Architecture Decision
```
┌─────────────────────────────────────────┐
│ UI Client (Browser)                     │
│ - WaaP SDK handles wallet UI            │
│ - User logs in via email/social/        │
│   wallet                                │
│ - Signs SIWE message                    │
└──────────────┬──────────────────────────┘
               │ POST { message, signature }
               ▼
┌─────────────────────────────────────────┐
│ Knowledge Server (Worker)               │
│ - viem/siwe verifies signature          │
│ - Checks Hats Protocol roles            │
│ - Issues OAuth token                    │
└─────────────────────────────────────────┘
```

### Key Libraries
| Component | Library | Runtime |
|-----------|---------|---------|
| Frontend wallet UI | `@human.tech/waap-sdk` | Browser |
| SIWE message signing | `window.waap.request({ method: 'personal_sign' })` | Browser |
| SIWE verification | `viem/siwe` | Edge (Worker) |
| Role checking | `@hatsprotocol/sdk-v1-core` + viem | Edge (Worker) |

### Why NOT WalletConnect
- WalletConnect adds unnecessary complexity
- WaaP handles wallet connections natively (injected wallets + MPC wallets)
- No `WALLETCONNECT_PROJECT_ID` required
- Simpler integration, fewer dependencies

---

## Current Progress

- [x] Phase 0: Template scaffolded from `cloudflare/ai/demos/remote-mcp-github-oauth`
- [x] Dependencies installed (hono, viem, @hatsprotocol/sdk-v1-core, etc.)
- [x] TypeScript compiles (`npm run type-check` passes)
- [x] `src/env.d.ts` created for secret type definitions
- [ ] Phase 0.5: GitHub OAuth App setup (HITL)
- [ ] Package 0: Schemas (v0.11 ontology alignment)
- [ ] Packages 1-5: Implementation
- [ ] Package 6: MCP Resources & Prompts
- [ ] Integration
- [ ] **Knowledge base ontology implementation** (external dependency)

---

## Phase 0.5: GitHub OAuth Setup (HITL - Human Required)

**⚠️ STOP: This step requires human action.**

Claude Code should pause here and display these instructions to the user:

```
═══════════════════════════════════════════════════════════════════
HUMAN ACTION REQUIRED: Create GitHub OAuth App for Local Development
═══════════════════════════════════════════════════════════════════

1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - Application name: knowledge-server-dev
   - Homepage URL: http://localhost:8788
   - Authorization callback URL: http://localhost:8788/callback
4. Click "Register application"
5. Copy the Client ID
6. Click "Generate a new client secret" and copy it

7. Generate encryption key (run in terminal):
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

8. Create .dev.vars file in project root with:
   GITHUB_CLIENT_ID=<your_client_id>
   GITHUB_CLIENT_SECRET=<your_client_secret>
   COOKIE_ENCRYPTION_KEY=<your_random_hex>

9. Verify with: npm run dev

Reply "done" when complete.
═══════════════════════════════════════════════════════════════════
```

---

## Parallelization Strategy

This plan supports parallel development using Claude Code Web for isolated modules, with final integration in local Claude Code (IDE/terminal).

### Environment Considerations

| Environment | Best For | Limitations |
|-------------|----------|-------------|
| **CC Web** | Pure TS modules, schemas, logic with mockable deps | No wrangler, no local bindings |
| **CC Local** | Integration, wrangler dev, MCP Inspector, deployment | Linear, slower iteration |

### Work Packages

Execute packages 1-5 in parallel after Package 0 is merged. Package 6 (MCP Resources & Prompts) follows integration.

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
│    CC Web ✅    │ │    CC Web ✅    │ │    CC Web ✅    │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
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
              │ MCP Resources/Prompts │
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
├── auth.ts        # AuthProps, AccessTier, HatsRoles
└── api.ts         # API request/response types
```

### content.ts — Content Model (v0.11)

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

// FileSchema — base for all types (v0.11 fields)
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

/**
 * R2Document stored in superbenefit-knowledge bucket.
 * Key format: content/{contentType}/{id}.json
 */
export interface R2Document {
  id: string;                    // Vector ID, R2 key stem
  contentType: ContentType;      // Leaf type
  path: string;                  // Original GitHub path
  metadata: Record<string, any>; // Frontmatter fields
  content: string;               // Markdown body
  syncedAt: string;              // ISO timestamp
  commitSha: string;             // Git commit reference
}

/**
 * Vectorize metadata structure.
 * Total must be under 10 KiB per vector.
 */
export interface VectorMetadata {
  // Indexed fields (used for filtering) — ~200 bytes
  contentType: string;
  group: string;
  tags: string;                  // Comma-separated
  release: string;
  status: string;
  date: number;                  // Unix timestamp ms
  
  // Non-indexed fields (for retrieval/reranking) — ~8800 bytes
  path: string;                  // R2 object key
  title: string;
  description: string;
  content: string;               // Truncated body for reranking
}

// Vectorize limits
export const VECTORIZE_LIMITS = {
  METADATA_MAX_BYTES: 10 * 1024,         // 10 KiB
  VECTOR_ID_MAX_BYTES: 64,
  STRING_INDEX_MAX_BYTES: 64,            // First 64 bytes indexed
  TOP_K_WITH_METADATA: 20,
  TOP_K_WITHOUT_METADATA: 100,
  MAX_METADATA_INDEXES: 10,
} as const;

// Content truncation for metadata
const MAX_CONTENT_LENGTH = 8000;  // ~8KB, leaves room for other fields

export function truncateForMetadata(content: string): string {
  if (content.length <= MAX_CONTENT_LENGTH) return content;
  
  // Truncate at word boundary
  const truncated = content.slice(0, MAX_CONTENT_LENGTH);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.slice(0, lastSpace) + '...';
}

/**
 * Generate document ID from file path.
 * Example: "artifacts/patterns/cell-governance.md" → "cell-governance"
 */
export function generateId(path: string): string {
  const filename = path.split('/').pop() || path;
  const id = filename.replace(/\.md$/, '');
  
  if (new TextEncoder().encode(id).length > VECTORIZE_LIMITS.VECTOR_ID_MAX_BYTES) {
    throw new Error(`ID exceeds 64 byte limit: ${id}`);
  }
  
  return id;
}

/**
 * Construct R2 object key from contentType and ID.
 */
export function toR2Key(contentType: ContentType, id: string): string {
  return `content/${contentType}/${id}.json`;
}

/**
 * Extract ID from R2 object key.
 */
export function extractIdFromKey(key: string): string {
  const parts = key.split('/');
  const filename = parts[parts.length - 1];
  return filename.replace(/\.json$/, '');
}

/**
 * Extract contentType from R2 object key.
 */
export function extractContentTypeFromKey(key: string): ContentType {
  const parts = key.split('/');
  return parts[1] as ContentType;
}
```

### CC Web Kickoff Prompt

```
I'm implementing Package 0 (Schemas) for the SuperBenefit knowledge-server.

Reference: spec-v0.11.md Sections 3-4

Create src/types/ with:

1. content.ts:
   - ContentTypeSchema enum (20 types from ontology)
   - RESOURCE_TYPES, STORY_TYPES, REFERENCE_TYPES, DATA_TYPES arrays
   - PATH_TYPE_MAP for directory → type inference
   - inferContentType() helper
   - FileSchema (base) with v0.11 fields
   - Parent schemas: ReferenceSchema, ResourceSchema, StorySchema, DataSchema
   - Concrete type schemas for all 16 leaf types
   - ContentSchema discriminated union

2. storage.ts:
   - R2Document interface
   - VectorMetadata interface (indexed + non-indexed fields)
   - VECTORIZE_LIMITS constants
   - truncateForMetadata(content): string — truncate to ~8KB at word boundary
   - generateId(path): string — extract ID from path, validate 64 byte limit
   - toR2Key(contentType, id): string — construct R2 object key
   - extractIdFromKey(key): string — extract ID from R2 key
   - extractContentTypeFromKey(key): ContentType

3. auth.ts:
   - AccessTier: 'public' | 'member' | 'vibecoder'
   - HatsRoles: { isContributor: boolean, isMember: boolean, tier: AccessTier }
   - AuthProps: { address, tier, roles, ensName?, chainId }

4. api.ts:
   - SearchFilters: { contentType?, group?, release?, status?, tags? }
   - SearchResult: { id, contentType, title, description, score, rerankScore? }
   - RerankResult: { id, score, rerankScore, metadata: VectorMetadata }
   - ListEntriesResponse, SearchResponse schemas

5. index.ts: re-exports

The ontology document defines the full type hierarchy and fields.
```

---

## Package 1: Auth Module

**Branch:** `feat/auth`  
**Environment:** CC Web ✅  
**Dependencies:** Package 0

```
src/auth/
├── siwe.ts        # SIWE verification with viem/siwe
├── hats.ts        # Hats Protocol role checking
├── ens.ts         # ENS resolution
├── nonce.ts       # Nonce management (KV)
├── oauth.ts       # OAuthProvider config
└── index.ts       # Exports
```

All functions accept `deps` as params for testability:
```typescript
interface AuthDeps {
  mainnetClient: PublicClient;
  optimismClient: PublicClient;
  nonceKV: KVNamespace;
  roleCache: KVNamespace;
  ensCache: KVNamespace;
}
```

### CC Web Kickoff Prompt

```
I'm implementing Package 1 (Auth Module) for the SuperBenefit knowledge-server.

Reference: spec-v0.11.md Section 2 (Authentication & Authorization)

IMPORTANT: WaaP (@human.tech/waap-sdk) is a FRONTEND SDK that runs in the browser.
The knowledge-server Worker only handles SIWE VERIFICATION using viem/siwe.

Create src/auth/ with:

1. siwe.ts:
   - createNonce(deps): Promise<string>
   - validateNonce(nonce, deps): Promise<boolean>
   - verifySIWE(message, signature, deps): Promise<{ address, chainId }>
   - CRITICAL: Use viem/siwe (parseSiweMessage, verifySiweMessage)
   - NOT the standalone siwe package (Buffer issues in edge runtime)

2. hats.ts:
   - HATS_CONTRACT, TREE_ID, HAT_PATHS constants
   - checkHatsRoles(address, deps): Promise<HatsRoles>
   - Use @hatsprotocol/sdk-v1-core for treeIdToHatId

3. ens.ts:
   - resolveENS(address, deps): Promise<{ name?, avatar? }>
   - Cache results in ENS_CACHE (1 hour TTL)

4. nonce.ts:
   - Nonce KV helpers with 5 min TTL

5. oauth.ts:
   - OAuthProvider configuration
   - tokenExchangeCallback for role refresh
   - authPageHandler: serves static HTML that loads WaaP SDK from CDN

6. index.ts: exports

Functions accept deps as params for testability.
Import types from src/types/.
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

Reference: spec-v0.11.md Section 6 (Retrieval System)

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
   - Fetch from R2 using metadata.path
   - Use R2ObjectBody.json<R2Document>() for parsing
   - Only called for final top-5 after reranking
   - getDocument(contentType, id, deps): Promise<R2Document | null>
   - Use toR2Key() from src/types/storage.ts

5. cache.ts:
   - hashQuery(query, ids): string

6. index.ts:
   - searchKnowledge(query, filters, options, deps): Promise<SearchResult[]>
   - Three-stage flow: embed → filter → rerank → fetch
   - options.includeDocuments controls whether to fetch full R2 docs

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

Reference: spec-v0.11.md Section 8 (Public REST API)

Create src/api/ with:

1. schemas.ts:
   - ListEntriesQuerySchema, SearchQuerySchema
   - ListEntriesResponseSchema, SearchResponseSchema
   - R2DocumentSchema (for single entry response)
   - Use ContentTypeSchema from src/types/content.ts

2. routes.ts:
   - OpenAPIHono app with CORS (origin: '*', methods: GET/HEAD/OPTIONS)
   - GET /entries — list/filter entries
   - GET /entries/{contentType}/{id} — single entry (two path params)
   - GET /search — semantic search
   - GET /openapi.json — OpenAPI spec
   - Cache headers: max-age=300, stale-while-revalidate=3600

3. handlers/entries.ts:
   - listEntries handler
   - getEntry handler — uses getDocument(contentType, id, deps)

4. handlers/search.ts:
   - search handler — uses searchKnowledge()

5. index.ts:
   - Export configured api router

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

Reference: spec-v0.11.md Section 5 (Sync Layer)

Create src/sync/ with:

1. workflow.ts:
   - KnowledgeSyncWorkflow extends WorkflowEntrypoint
   - Process changedFiles: fetch from GitHub, parse, store to R2
   - Process deletedFiles: remove from R2
   - CRITICAL: Only sync publish:true AND draft:false content
   - Use NonRetryableError for 404s
   - Retry config: limit 5, delay 30s, exponential backoff
   - Store R2Document at toR2Key(contentType, id)

2. parser.ts:
   - parseMarkdown(content: string): { frontmatter, body }
   - Use yaml package for frontmatter parsing
   - Validate frontmatter against FileSchema

3. transform.ts:
   - Uses generateId() and toR2Key() from src/types/storage.ts
   - normalizeContent(parsed, path): R2Document

4. github.ts:
   - verifyWebhookSignature(body, signature, secret): boolean
   - fetchFileContent(path, commitSha, token): Promise<string>

Import inferContentType from src/types/content.ts.
Import generateId, toR2Key, R2Document from src/types/storage.ts.
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

Reference: spec-v0.11.md Sections 4.3-4.4 and 5.3

This implements the ID-based storage pattern:
- Vector ID = doc.id (same as R2 key stem)
- metadata.path = R2 object key for later fetching
- metadata.content = truncated body for reranking (within 10 KiB limit)

Create src/consumers/ with:

1. vectorize.ts:
   - updateVectorize(doc: R2Document, deps): Promise<void>
   - Generate embedding with @cf/baai/bge-base-en-v1.5
   - Build VectorMetadata with indexed + non-indexed fields
   - CRITICAL: Use truncateForMetadata() for content field
   - CRITICAL: metadata.path = toR2Key(contentType, id) for later retrieval
   - Upsert to Vectorize with id = doc.id
   - deleteFromVectorize(id, deps): Promise<void>
   - Use extractIdFromKey() from src/types/storage.ts

2. cache.ts:
   - invalidateCache(doc: R2Document, cache: KVNamespace): Promise<void>
   - Clear relevant rerank cache entries

3. handler.ts:
   - Queue handler for R2 event notifications
   - CRITICAL: Use per-message msg.ack(), NOT batch.ackAll()
   - Only process content/ prefix objects
   - Handle object-create and object-delete events
   - For object-create: fetch R2Document, call updateVectorize
   - For object-delete: extract ID, call deleteFromVectorize

Import types and helpers from src/types/storage.ts.
```

---

## Package 6: MCP Resources & Prompts

**Branch:** `feat/mcp-extras`  
**Environment:** CC Web or CC Local  
**Dependencies:** Integration complete

This package adds MCP Resources and Prompts to complete the client experience.

### MCP Primitives Overview

| Primitive | Controlled By | Purpose |
|-----------|---------------|---------|
| **Tools** | AI model | Callable functions AI autonomously invokes |
| **Resources** | Application | Read-only data clients inject as context |
| **Prompts** | User | Workflow templates users explicitly invoke |

### Files to Create

```
src/mcp/
├── server.ts      # McpServer setup + createMcpHandler
├── tools.ts       # Tool registrations
├── resources.ts   # Resource registrations (NEW)
├── prompts.ts     # Prompt registrations (NEW)
└── index.ts       # Exports
```

### resources.ts

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerResources(server: McpServer, env: Env) {
  // System prompt for knowledge search
  server.resource(
    "prompts/knowledge-search",
    "mcp://superbenefit/prompts/knowledge-search",
    {
      description: "System prompt optimized for SuperBenefit knowledge base search",
      mimeType: "text/plain"
    },
    async () => ({
      contents: [{
        uri: "mcp://superbenefit/prompts/knowledge-search",
        mimeType: "text/plain",
        text: KNOWLEDGE_SEARCH_SYSTEM_PROMPT
      }]
    })
  );

  // Ontology documentation
  server.resource(
    "data/ontology",
    "mcp://superbenefit/data/ontology",
    {
      description: "Content type hierarchy and metadata schema documentation",
      mimeType: "application/json"
    },
    async () => ({
      contents: [{
        uri: "mcp://superbenefit/data/ontology",
        mimeType: "application/json",
        text: JSON.stringify(ONTOLOGY_SCHEMA, null, 2)
      }]
    })
  );

  // Groups list
  server.resource(
    "data/groups",
    "mcp://superbenefit/data/groups",
    {
      description: "List of SuperBenefit groups/cells with metadata",
      mimeType: "application/json"
    },
    async () => {
      const groups = await listGroups(env);
      return {
        contents: [{
          uri: "mcp://superbenefit/data/groups",
          mimeType: "application/json",
          text: JSON.stringify(groups, null, 2)
        }]
      };
    }
  );
}
```

### prompts.ts

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer, env: Env) {
  // Research workflow
  server.prompt(
    "research-topic",
    "Research a topic comprehensively across the SuperBenefit knowledge base",
    [
      { name: "topic", description: "Topic to research", required: true },
      { name: "depth", description: "Research depth: shallow or deep", required: false },
    ],
    async ({ topic, depth = "shallow" }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Research the topic "${topic}" in the SuperBenefit knowledge base.

${depth === "deep" ? `
Provide a comprehensive analysis including:
1. Core concepts and definitions from the lexicon
2. Related patterns and practices from artifacts
3. External resources from the library
4. Cross-references to other relevant topics
5. Gaps or areas needing more documentation
` : `
Provide a brief summary including:
1. Key definition from the lexicon
2. Most relevant artifact
3. One or two external resources
`}

Use the search_knowledge and define_term tools as needed.`
        }
      }]
    })
  );

  // Explain a DAO pattern
  server.prompt(
    "explain-pattern",
    "Explain a DAO pattern with examples and context",
    [
      { name: "pattern", description: "Pattern name to explain", required: true },
    ],
    async ({ pattern }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Explain the DAO pattern "${pattern}" as documented in SuperBenefit's knowledge base.

Include:
1. Definition from the lexicon
2. How it works in practice
3. Examples from SuperBenefit's experience
4. Related patterns
5. When to use vs. alternatives

Use the search_knowledge and define_term tools to find accurate information.`
        }
      }]
    })
  );

  // Compare governance approaches
  server.prompt(
    "compare-practices",
    "Compare two governance or coordination practices",
    [
      { name: "practice1", description: "First practice to compare", required: true },
      { name: "practice2", description: "Second practice to compare", required: true },
    ],
    async ({ practice1, practice2 }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Compare "${practice1}" and "${practice2}" as governance/coordination approaches.

Structure your comparison:
1. Brief definition of each
2. Key similarities
3. Key differences
4. When to use each
5. How they might complement each other

Use the search_knowledge tool to find relevant documentation for both.`
        }
      }]
    })
  );
}
```

### CC Web Kickoff Prompt

```
I'm implementing Package 6 (MCP Resources & Prompts) for the SuperBenefit knowledge-server.

Reference: spec-v0.11.md Sections 7.4-7.5

MCP Primitives:
- Tools: AI-controlled functions (already implemented)
- Resources: App-controlled read-only data (this package)
- Prompts: User-controlled workflow templates (this package)

Create/update src/mcp/ with:

1. resources.ts:
   - registerResources(server: McpServer, env: Env): void
   - prompts/knowledge-search: System prompt for knowledge search
   - data/ontology: Content type hierarchy JSON
   - data/groups: List of groups/cells
   - data/releases: List of creative releases
   - Use server.resource() API with URI format mcp://superbenefit/...

2. prompts.ts:
   - registerPrompts(server: McpServer, env: Env): void
   - research-topic: Multi-step research workflow (topic, depth args)
   - explain-pattern: Explain a DAO pattern with examples (pattern arg)
   - compare-practices: Compare two approaches (practice1, practice2 args)
   - Use server.prompt() API with argument definitions

3. Update server.ts to call registerResources and registerPrompts

Client support:
- Claude Desktop: Full support
- Claude Code: Full support
- Cursor/Windsurf: Limited (focus on tools)

Import types from src/types/.
```

---

## Integration (Local Only)

**Branch:** `main` or `feat/integration`  
**Environment:** CC Local ⚠️  
**Dependencies:** All packages merged

Tasks:
- Wire `src/index.ts` router (mount api + oauth routes)
- Implement `src/mcp/server.ts` with createMcpHandler pattern
- Implement `src/mcp/tools.ts` with permission wrapper
- Update `wrangler.jsonc` with actual binding IDs
- Test with `wrangler dev` + MCP Inspector
- Test REST API with curl
- Deploy

### MCP Server Implementation (v0.11 Pattern)

```typescript
// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { registerTools } from "./tools";
import { registerResources } from "./resources";
import { registerPrompts } from "./prompts";

export function createKnowledgeServer(env: Env) {
  const server = new McpServer({
    name: "superbenefit-knowledge",
    version: "1.0.0",
  });

  // Register all primitives
  registerTools(server, env);
  registerResources(server, env);
  registerPrompts(server, env);

  return server;
}

// Handler for OAuthProvider integration
export const McpHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const server = createKnowledgeServer(env);
    return createMcpHandler(server, {
      corsOptions: { origins: ["*"] }
    })(request, env, ctx);
  }
};
```

### Permission Wrapper Pattern

```typescript
// src/mcp/tools.ts
type AccessTier = 'public' | 'member' | 'vibecoder';
type ToolHandler = (params: any, context: any) => Promise<{ content: any[] }>;

function requireTier(requiredTier: AccessTier, handler: ToolHandler): ToolHandler {
  const tierLevel = { public: 0, member: 1, vibecoder: 2 };
  
  return async (params, context) => {
    const userTier = context.props?.tier || 'public';
    
    if (tierLevel[userTier] < tierLevel[requiredTier]) {
      return {
        content: [{
          type: "text",
          text: `Access denied. This tool requires ${requiredTier} access.`
        }],
        isError: true
      };
    }
    
    return handler(params, context);
  };
}

// Usage:
server.tool(
  "get_document",
  "Get full document content by ID",
  { contentType: ContentTypeSchema, id: z.string() },
  requireTier('member', async ({ contentType, id }, context) => {
    const doc = await getDocument(contentType, id, env);
    return { content: [{ type: "text", text: JSON.stringify(doc) }] };
  })
);
```

### Router Integration

```typescript
// src/index.ts
import { Hono } from 'hono';
import { api } from './api';
import { OAuthProvider } from "workers-oauth-provider";
import { McpHandler } from "./mcp/server";
import { SIWEHandler } from "./auth/oauth";

const app = new Hono<{ Bindings: Env }>();

// Public REST API (no auth, CORS enabled)
app.route('/api/v1', api);

// MCP + OAuth routes handled by OAuthProvider
const oauthProvider = new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: McpHandler,
  defaultHandler: SIWEHandler,
  refreshTokenTTL: 2592000,
  // ... config
});

app.all('/mcp/*', (c) => oauthProvider.fetch(c.req.raw, c.env, c.executionCtx));
app.all('/authorize', (c) => oauthProvider.fetch(c.req.raw, c.env, c.executionCtx));
app.all('/token', (c) => oauthProvider.fetch(c.req.raw, c.env, c.executionCtx));
app.all('/siwe/*', (c) => oauthProvider.fetch(c.req.raw, c.env, c.executionCtx));
app.all('/register', (c) => oauthProvider.fetch(c.req.raw, c.env, c.executionCtx));

export default app;
```

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

# Create KV namespaces
npx wrangler kv:namespace create OAUTH_KV
npx wrangler kv:namespace create NONCE_KV
npx wrangler kv:namespace create ROLE_CACHE
npx wrangler kv:namespace create ENS_CACHE
npx wrangler kv:namespace create RERANK_CACHE
npx wrangler kv:namespace create SYNC_STATE

# Configure R2 event notifications
npx wrangler r2 bucket notification create superbenefit-knowledge \
  --event-type object-create --event-type object-delete \
  --queue superbenefit-knowledge-sync \
  --prefix content/
```

---

## Testing Strategy

### Local Testing

```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: MCP Inspector
npx @modelcontextprotocol/inspector
# Connect to http://localhost:8788/mcp
```

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
2. [ ] `wrangler.jsonc` has actual binding IDs
3. [ ] Secrets configured via `wrangler secret put`
4. [ ] Vectorize metadata indexes created
5. [ ] R2 event notifications configured
6. [ ] GitHub webhook pointing to deployed URL
7. [ ] Deploy: `npm run deploy`
8. [ ] Verify: MCP Inspector connects
9. [ ] Verify: REST API responds
10. [ ] Trigger sync: push to knowledge-base

---

## Future Phases Reference

### Phase 2: Stateful Services

**When to implement:** After Phase 1 is stable and you need:
- AI chat interfaces with persistent history
- Human-in-the-loop approval for write operations
- Multi-step tool chains
- Automated PR creation

**Architecture:** `AIChatAgent` + AI SDK `tool()` with `needsApproval`

**Key additions:**
- Durable Object binding for agent state
- React client with `useAgentChat()` hook
- GitHub API integration for PRs

### Phase 3: Knowledge Commons

**When to implement:** After Phase 2 and you want:
- Cross-DAO knowledge federation
- Partner MCP server connections
- Aggregated search across ecosystems

**Architecture:** `Agent` as MCP Client with `addMcpServer()`

**Key additions:**
- Partner MCP server agreements
- OAuth handling for external servers
- Aggregation UI

---

## Dependencies (v0.11)

```json
{
  "dependencies": {
    "@hatsprotocol/sdk-v1-core": "^0.10.0",
    "@hono/zod-openapi": "^0.15.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "agents": "^0.3.0",
    "hono": "^4.0.0",
    "viem": "^2.21.0",
    "workers-oauth-provider": "^0.2.0",
    "yaml": "^2.3.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240620.0",
    "typescript": "^5.5.0",
    "wrangler": "^3.60.0"
  }
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.6 | 2026-02-01 | MCP patterns: stateless createMcpHandler, permission wrapper, Package 6 (Resources/Prompts), phased architecture summary, future phases reference, updated dependencies |
| 2.5 | 2026-02-01 | ID-based retrieval: storage.ts types, fetch.ts module, updated vectorize consumer |
| 2.4 | 2026-02-01 | Ontology alignment: Package 0 content model, v0.9 schema updates |
| 2.3 | 2026-01-30 | Initial parallelization strategy, CC Web kickoff prompts |