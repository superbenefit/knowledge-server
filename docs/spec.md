# SuperBenefit AI Tools Infrastructure Specification

**Version:** 0.12  
**Date:** February 6, 2026  
**Access Control Reference:** `porch-spec.md` v0.14

---

## 1. Overview

### 1.1 Purpose

This specification defines the architecture for SuperBenefit's AI tools infrastructure. The system enables DAO members to access curated AI tools through a unified MCP interface, backed by a synchronized knowledge base from GitHub and authenticated via the porch access control framework. A public REST API provides unauthenticated read access for external consumers and web integrations.

### 1.2 Prerequisites

**Knowledge Base Ontology Implementation**

Before content can be synced to the knowledge server, the knowledge base repository must implement the ontology defined in `ontology.md`. This includes:

1. Directory restructuring (`artifacts/`, `data/`, `links/`, `tags/`, `notes/`, `drafts/`)
2. Metadata Menu fileClass definitions in `/tools/types/`
3. Migration of existing content to new structure
4. Addition of required frontmatter fields (`group`, `release`, etc.)

The knowledge server schemas depend on this structure being in place. See ontology.md "Migration Tasks" section for the implementation checklist.

### 1.3 Design Principles

1. **Cloudflare-native** — No containers, Kubernetes, or external orchestration
2. **Single connection point** — Members configure one URL, get all tools
3. **Porch access control** — Three-tier framework: Open → Public → Members (see `porch-spec.md`)
4. **R2 as canonical store** — GitHub syncs to R2; consumers read from R2
5. **Event-driven updates** — R2 notifications trigger consumer updates
6. **Two-stage retrieval** — Metadata filtering + reranking for quality
7. **ID-based document lookup** — Vector ID maps directly to R2 object key
8. **Dual interface** — MCP for AI tools, REST for web/external access
9. **Schema-first** — Single source of truth for content types across all consumers
10. **Phased evolution** — Stateless tools → Stateful agents → Federation

### 1.4 Key Architectural Decisions

**Why the porch framework (not in-Worker OAuth)?**
- Phase 1 ships immediately with no authentication — all tools Open tier
- Phase 2 adds auth via Cloudflare Access for SaaS — infrastructure-layer, not Worker code
- `authContext` injection into `createMcpHandler` replaces `OAuthProvider` wrapper entirely
- ~680 lines of OAuth code eliminated from Worker; auth becomes a platform concern
- New SB servers get auth for free by registering in the same Portal

**Why R2 as canonical store (not direct to Vectorize)?**
- Single source of truth for all consumers
- Decouples sync from search indexing
- Event notifications enable multi-consumer fan-out

**Why not AI Search (AutoRAG)?**
- AI Search only indexes 2 metadata fields
- SuperBenefit needs `contentType`, `group`, `release`, etc.
- Custom Vectorize provides up to 10 indexed metadata fields

**Why ID-based retrieval (not embedded content)?**
- Vector ID directly maps to R2 object key — simple, predictable lookup
- Metadata stores content snippet for reranking — avoids R2 round-trips during ranking
- Full document fetch only for final top-K results — minimizes latency

**Why a public REST API alongside MCP?**
- Web applications need HTTP endpoints, not MCP protocol
- External partners and tools expect REST interfaces
- OpenAPI spec enables code generation and documentation
- Read-only public access requires no authentication overhead

**Why `createMcpHandler` (not `McpAgent` class)?**
- Stateless handler is simpler for Phase 1 (search/retrieval)
- `authContext` option enables Phase 2 identity injection without code restructuring
- Easier to test and reason about
- Upgrade path to stateful `Agent` class for Phase 2 when needed

### 1.5 Reference Implementations

| Component | Official Reference |
|-----------|-------------------|
| createMcpHandler (stateless) | `npm create cloudflare@latest -- --template=cloudflare/ai/demos/remote-mcp-server` |
| createMcpHandler + Access for SaaS | `npm create cloudflare@latest -- --template=cloudflare/ai/demos/remote-mcp-cf-access` |
| McpAgent (stateful, Phase 2+) | `npm create cloudflare@latest -- --template=cloudflare/ai/demos/remote-mcp-github-oauth` |
| Workflows | `npm create cloudflare@latest -- --template=cloudflare/workflows-starter` |
| R2 Events | [developers.cloudflare.com/r2/tutorials/upload-logs-event-notifications](https://developers.cloudflare.com/r2/tutorials/upload-logs-event-notifications/) |
| SIWE | [github.com/spruceid/siwe-oidc](https://github.com/spruceid/siwe-oidc) |
| Hono OpenAPI | [github.com/honojs/middleware/tree/main/packages/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) |
| RAG Tutorial | [developers.cloudflare.com/workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai/) |
| AIChatAgent | [developers.cloudflare.com/agents/api-reference/agents-api](https://developers.cloudflare.com/agents/api-reference/agents-api/) |
| MCP Client API | [developers.cloudflare.com/agents/model-context-protocol/mcp-client-api](https://developers.cloudflare.com/agents/model-context-protocol/mcp-client-api/) |
| MCP Server Portals | [developers.cloudflare.com/agents/model-context-protocol/mcp-server-portals](https://developers.cloudflare.com/agents/model-context-protocol/mcp-server-portals/) |

### 1.6 System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              GitHub                                       │
│                    superbenefit/knowledge-base                           │
│                            │ push webhook                                 │
└────────────────────────────┼─────────────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Sync Layer: Webhook → Workflow → R2 → Event → Queue → Consumers        │
└────────────────────────────┼─────────────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Application Layer (porch.superbenefit.dev)                               │
│                                                                          │
│  Public REST API (no auth, CORS enabled)                                 │
│  ├── /api/v1/entries         → List/filter entries                       │
│  ├── /api/v1/entries/{t}/{id}→ Get single entry                          │
│  ├── /api/v1/search          → Semantic search                           │
│  └── /api/v1/openapi.json    → OpenAPI specification                     │
│                                                                          │
│  MCP Server (direct to handler, bypassing Hono)                          │
│  └── /mcp                    → createMcpHandler (Tools, Resources,       │
│                                Prompts, authContext injection)            │
│                                                                          │
│  Access control: resolveAuthContext() → checkTierAccess()                │
│  Phase 1: All tools Open tier (no auth)                                  │
│  Phase 2+: Access JWT → authContext → tier resolution                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.7 Phased Architecture

| Phase | Focus | Architecture | Access |
|-------|-------|--------------|--------|
| **1. Foundation** | Search, retrieval, API | Stateless `createMcpHandler` | Open tier only (no auth) |
| **2. Stateful Services** | AI chat, agents, PRs | `AIChatAgent` + AI SDK `tool()` | + Public tier (Access for SaaS) |
| **3. Knowledge Commons** | Multi-DAO federation | `Agent` as MCP Client | + Members tier (Hats/token gate) |

---

## 2. Access Control

> **Full specification**: See `porch-spec.md` v0.14 for the complete access control framework including tier definitions, identity model, authorization resolution, and phased implementation.

This section summarizes the access control integration points in the knowledge server.

### 2.1 Tier Model

| Tier | Economics | Authentication | Authorization |
|------|-----------|----------------|---------------|
| **Open** | Non-excludable, non-rivalrous | None | None |
| **Public** | Non-excludable, rivalrous | Required (wallet or GitHub) | Sybil resistance |
| **Members** | Excludable, rivalrous | Required | Hats/token/org check |

### 2.2 Framework Interface

```typescript
// src/auth/types.ts

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
```

### 2.3 Auth Context Resolution

```typescript
// src/auth/resolve.ts
import { getMcpAuthContext } from 'agents/mcp';

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

### 2.4 Tier Checking

```typescript
// src/auth/check.ts

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

### 2.5 Hats Protocol Configuration

> **Note**: Dormant in Phase 1. Active when porch enables Members tier (Phase 3).

| Setting | Value |
|---------|-------|
| Chain | Optimism (10) |
| Contract | `0x3bc1A0Ad72417f2d411118085256fC53CBdDd137` |
| Tree ID | 30 |

| Hat Path | Role | Tier |
|----------|------|------|
| `30.3.1` | Contributor | `members` |
| `30.3.5` | Community Member | `members` |
| (none) | Public | `open` or `public` |

```typescript
import { treeIdToHatId } from '@hatsprotocol/sdk-v1-core';

const HATS = {
  contributor: treeIdToHatId(30, [3, 1]),
  member: treeIdToHatId(30, [3, 5])
};
```

### 2.6 Phase 2: authContext Injection

When Cloudflare Access for SaaS is configured, the Worker receives authenticated requests with a `CF-Access-JWT-Assertion` header. The Worker parses this JWT, validates against `CF_ACCESS_AUD`, and passes the claims to `createMcpHandler` via the `authContext` option. This populates `getMcpAuthContext()` inside tools without any `OAuthProvider` dependency:

```typescript
// Phase 2 addition to src/index.ts fetch handler
const claims = await validateAccessJWT(request, env.CF_ACCESS_AUD);
const handler = createMcpHandler(server, {
  route: '/mcp',
  corsOptions: { origin: '*' },
  authContext: claims ? { props: claims } : undefined,
});
```

This is the **only** Worker-side change for Phase 2 auth. All tier resolution happens in `resolveAuthContext()` by uncommenting the Phase 2 block.

### 2.7 WaaP Integration (UI Client)

> **Note:** WaaP is a **frontend wallet SDK** that runs in the browser. It provides the wallet that signs SIWE messages. The knowledge server does not depend on WaaP directly.

| Auth Method | User Type | How It Works |
|-------------|-----------|--------------|
| Wallet | Web3 natives | Browser wallets (MetaMask, etc.) via WaaP's EIP-1193 interface |
| Email | Newcomers | WaaP creates MPC wallet (2PC with Ika network) |
| Social | Newcomers | GitHub/Discord/Google → MPC wallet via WaaP |

WaaP (`@human.tech/waap-sdk`) runs in the frontend chat interfaces (`front.porch.superbenefit.dev/ai` and `back.porch.superbenefit.dev/ai`). It handles wallet creation and SIWE message signing. The signed SIWE message flows through the SIWE OIDC IdP (a separate Worker) registered in Cloudflare Access, which issues standard OIDC tokens. The knowledge server receives these as Access JWTs — it never interacts with WaaP directly.

---

## 3. Content Model

### 3.1 Knowledge Base Directory Structure

```
knowledge-base/
├── artifacts/           # resources and stories
│   ├── patterns/        # pattern — reusable solutions
│   ├── practices/       # practice — documented ways of doing
│   ├── primitives/      # primitive — foundational building blocks
│   ├── protocols/       # protocol — formal procedures
│   ├── playbooks/       # playbook — implementation guides
│   ├── questions/       # question — research questions
│   ├── studies/         # study — case studies
│   └── articles/        # article — essays, publications
├── data/                # entities/actors
│   ├── people/          # person — people profiles
│   ├── groups/          # group — organizations, cells, DAOs
│   ├── projects/        # project — time-bounded endeavors
│   ├── places/          # place — locations, bioregions
│   └── gatherings/      # gathering — events, conferences
├── links/               # link — curated external resources
├── tags/                # tag — lexicon definitions
├── notes/               # file — working documents
└── drafts/              # file — unpublished content
```

### 3.2 Type Hierarchy

```
file (root type)
├── fields: type, title, description, date, publish, draft, permalink, author, group
│
├── reference (extends file) — organizational content
│   ├── index — navigation pages
│   ├── link — external resources
│   └── tag — lexicon definitions
│
├── resource (extends file) — things that can be commoned
│   ├── pattern — reusable solutions
│   ├── practice — documented ways of doing
│   ├── primitive — foundational building blocks
│   ├── protocol — formal procedures
│   ├── playbook — implementation guides
│   └── question — research questions
│
├── story (extends file) — narratives
│   ├── study — case studies
│   └── article — essays, publications
│
└── data (extends file) — entities/actors
    ├── person — people profiles
    ├── group — organizations, cells, DAOs
    ├── project — time-bounded endeavors
    ├── place — locations, bioregions
    └── gathering — events, conferences
```

**Note**: The `guide` type from spec v0.8 is deprecated; use `article` for written guides.

### 3.3 Content Type Enum

```typescript
export const ContentTypeSchema = z.enum([
  // File type
  'file',
  // Reference types
  'reference', 'index', 'link', 'tag',
  // Resource types
  'resource', 'pattern', 'practice', 'primitive', 'protocol', 'playbook', 'question',
  // Story types
  'story', 'study', 'article',
  // Data types
  'data', 'person', 'group', 'project', 'place', 'gathering'
]);

export type ContentType = z.infer<typeof ContentTypeSchema>;
```

### 3.4 Parent Type Groupings

```typescript
export const RESOURCE_TYPES: ContentType[] = [
  'pattern', 'practice', 'primitive', 'protocol', 'playbook', 'question'
];
export const STORY_TYPES: ContentType[] = ['study', 'article'];
export const REFERENCE_TYPES: ContentType[] = ['index', 'link', 'tag'];
export const DATA_TYPES: ContentType[] = [
  'person', 'group', 'project', 'place', 'gathering'
];
```

### 3.5 Path → Type Mapping

```typescript
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
```

### 3.6 Schemas

**FileSchema (base for all types)**

```typescript
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
```

**Parent type schemas**

```typescript
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
```

**Concrete type schemas**

```typescript
// Reference types
export const LinkSchema = ReferenceSchema.extend({
  url: z.string().url(),
});

export const TagSchema = ReferenceSchema.extend({
  aliases: z.array(z.string()).optional(),
  relatedTerms: z.array(z.string()).optional(),
  category: z.string().optional(),
});

// Resource types
export const PatternSchema = ResourceSchema.extend({
  context: z.string().optional(),
  problem: z.string().optional(),
  solution: z.string().optional(),
  relatedPatterns: z.array(z.string()).optional(),
});

export const PracticeSchema = ResourceSchema.extend({
  patterns: z.array(z.string()).optional(),
  practitioners: z.array(z.string()).optional(),
});

export const PrimitiveSchema = ResourceSchema.extend({
  category: z.string().optional(),
});

export const ProtocolSchema = ResourceSchema.extend({
  steps: z.array(z.string()).optional(),
});

export const PlaybookSchema = ResourceSchema;

export const QuestionSchema = ResourceSchema.extend({
  status: z.enum(['open', 'exploring', 'resolved']).optional(),
  related: z.array(z.string()).optional(),
  proposedBy: z.array(z.string()).optional(),
});

// Story types
export const StudySchema = StorySchema;

export const ArticleSchema = StorySchema.extend({
  url: z.string().url().optional(),
  curator: z.string().optional(),
  harvester: z.string().optional(),
});

// Data types
export const PersonSchema = DataSchema.extend({
  aliases: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  groups: z.array(z.string()).optional(),
  homepage: z.string().url().optional(),
  email: z.string().email().optional(),
  image: z.string().optional(),
});

export const GroupSchema = DataSchema.extend({
  aliases: z.array(z.string()).optional(),
  members: z.array(z.string()).optional(),
  homepage: z.string().url().optional(),
  logo: z.string().optional(),
});

export const ProjectSchema = DataSchema.extend({
  status: z.enum(['active', 'completed', 'paused', 'archived']).optional(),
  lead: z.array(z.string()).optional(),
  homepage: z.string().url().optional(),
});

export const PlaceSchema = DataSchema.extend({
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  region: z.string().optional(),
});

export const GatheringSchema = DataSchema.extend({
  eventDate: z.coerce.date().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  homepage: z.string().url().optional(),
});
```

### 3.7 Content Discriminated Union

```typescript
export const ContentSchema = z.discriminatedUnion('type', [
  FileSchema.extend({ type: z.literal('file') }),
  ReferenceSchema.extend({ type: z.literal('reference') }),
  ReferenceSchema.extend({ type: z.literal('index') }),
  LinkSchema.extend({ type: z.literal('link') }),
  TagSchema.extend({ type: z.literal('tag') }),
  PatternSchema.extend({ type: z.literal('pattern') }),
  PracticeSchema.extend({ type: z.literal('practice') }),
  PrimitiveSchema.extend({ type: z.literal('primitive') }),
  ProtocolSchema.extend({ type: z.literal('protocol') }),
  PlaybookSchema.extend({ type: z.literal('playbook') }),
  QuestionSchema.extend({ type: z.literal('question') }),
  StudySchema.extend({ type: z.literal('study') }),
  ArticleSchema.extend({ type: z.literal('article') }),
  PersonSchema.extend({ type: z.literal('person') }),
  GroupSchema.extend({ type: z.literal('group') }),
  ProjectSchema.extend({ type: z.literal('project') }),
  PlaceSchema.extend({ type: z.literal('place') }),
  GatheringSchema.extend({ type: z.literal('gathering') }),
]);
```

---

## 4. Storage Architecture

### 4.1 R2 Canonical Store

**Bucket:** `superbenefit-knowledge`

```
content/{contentType}/{id}.json    # Normalized documents (full content)
raw/{path}.md                      # Original markdown (archive)
metadata/manifest.json             # Sync state
```

**R2Document Schema:**

```typescript
export interface R2Document {
  id: string;                    // Vector ID, R2 key stem (e.g., "cell-governance")
  contentType: ContentType;      // Leaf type (pattern, tag, person, etc.)
  path: string;                  // Original GitHub path
  metadata: Record<string, any>; // Frontmatter fields
  content: string;               // Markdown body
  syncedAt: string;              // ISO timestamp
  commitSha: string;             // Git commit reference
}
```

**Key constraints:**
- Object key max: 1,024 bytes
- Object metadata max: 8,192 bytes (R2 object metadata, not Vectorize)

### 4.2 ID Generation

```typescript
export function generateId(path: string): string {
  const filename = path.split('/').pop() || path;
  const id = filename.replace(/\.md$/, '');
  
  if (new TextEncoder().encode(id).length > 64) {
    throw new Error(`ID exceeds 64 byte limit: ${id}`);
  }
  
  return id;
}

export function toR2Key(contentType: ContentType, id: string): string {
  return `content/${contentType}/${id}.json`;
}
```

### 4.3 Vectorize Index

| Setting | Value |
|---------|-------|
| Dimensions | 768 (bge-base-en-v1.5) |
| Metric | cosine |
| Max vectors | 10,000,000 |

**Indexed Metadata (6 of 10 max):**

| Field | Type | Purpose |
|-------|------|---------|
| `contentType` | string | Filter by type (pattern, tag, etc.) |
| `group` | string | Filter by cell/project |
| `tags` | string | Filter by tags (comma-separated) |
| `release` | string | Filter by creative release |
| `status` | string | Filter projects by status |
| `date` | number | Sort by date (Unix timestamp ms) |

**Non-indexed Metadata (for retrieval/reranking):**

| Field | Purpose | Size estimate |
|-------|---------|---------------|
| `path` | R2 object key for document fetch | ~100 bytes |
| `title` | Display, reranking context | ~100 bytes |
| `description` | Display, reranking context | ~500 bytes |
| `content` | Truncated body for reranking | ~8,000 bytes |

**Critical constraint:** Metadata indexes must be created **before** inserting vectors.

### 4.4 Vector Structure

```typescript
interface VectorRecord {
  id: string;                    // Document ID (e.g., "cell-governance")
  values: number[];              // 768-dimensional embedding
  metadata: {
    // Indexed fields (used for filtering)
    contentType: string;
    group: string;
    tags: string;                // "governance,cells,coordination"
    release: string;
    status: string;
    date: number;                // Unix timestamp ms
    
    // Non-indexed fields (used for retrieval/reranking)
    path: string;                // "content/pattern/cell-governance.json"
    title: string;
    description: string;
    content: string;             // Truncated body (~8KB) for reranking
  };
}
```

**Content truncation:**

```typescript
const MAX_CONTENT_LENGTH = 8000;

export function truncateForMetadata(content: string): string {
  if (content.length <= MAX_CONTENT_LENGTH) return content;
  const truncated = content.slice(0, MAX_CONTENT_LENGTH);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.slice(0, lastSpace) + '...';
}
```

### 4.5 KV Namespaces

| Namespace | Purpose | TTL | Phase |
|-----------|---------|-----|-------|
| `ROLE_CACHE` | Hats roles | 5 min | Phase 3 (dormant) |
| `ENS_CACHE` | ENS resolution | 1 hour | Phase 3 (dormant) |
| `RERANK_CACHE` | Rerank results | 1 hour | Phase 1 (active) |
| `SYNC_STATE` | Sync metadata | None | Phase 1 (active) |

> **Removed in v0.12**: `OAUTH_KV` and `NONCE_KV` — no longer needed. Phase 2 uses `authContext` injection via `createMcpHandler`, not `OAuthProvider`. See `porch-spec.md` for rationale.

---

## 5. Sync Layer

### 5.1 GitHub Webhook Handler

```typescript
// Integrated into src/index.ts fetch handler
async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  if (!await verifyGitHubSignature(body, signature, env.GITHUB_WEBHOOK_SECRET)) {
    return new Response('Invalid signature', { status: 403 });
  }

  const payload = JSON.parse(body);
  if (payload.ref !== 'refs/heads/main') {
    return new Response('Ignored: not main branch');
  }

  const changedFiles = payload.commits
    .flatMap(c => [...c.added, ...c.modified])
    .filter(f => f.endsWith('.md') && !isExcluded(f));
  const deletedFiles = payload.commits
    .flatMap(c => c.removed)
    .filter(f => f.endsWith('.md'));

  await env.SYNC_WORKFLOW.create({
    params: { changedFiles, deletedFiles, commitSha: payload.after }
  });

  return Response.json({ status: 'ok' });
}
```

### 5.2 Sync Workflow

```typescript
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';

export class KnowledgeSyncWorkflow extends WorkflowEntrypoint<Env, SyncParams> {
  async run(event: WorkflowEvent<SyncParams>, step: WorkflowStep) {
    const { changedFiles, deletedFiles, commitSha } = event.payload;

    for (const filePath of changedFiles) {
      await step.do(`sync-${filePath}`, {
        retries: { limit: 5, delay: '30 seconds', backoff: 'exponential' },
        timeout: '2 minutes'
      }, async () => {
        const resp = await fetch(
          `https://api.github.com/repos/${this.env.GITHUB_REPO}/contents/${filePath}?ref=${commitSha}`,
          { headers: { 'Authorization': `Bearer ${this.env.GITHUB_TOKEN}` } }
        );
        
        if (resp.status === 429) throw new Error('Rate limited');
        if (resp.status === 404) throw new NonRetryableError('File not found');
        
        const data = await resp.json();
        const content = atob(data.content);
        const parsed = await this.parseMarkdown(content);
        
        if (!parsed.frontmatter.publish || parsed.frontmatter.draft) {
          return;
        }
        
        const contentType = inferContentType(filePath);
        const id = generateId(filePath);
        
        const r2Doc: R2Document = {
          id,
          contentType,
          path: filePath,
          metadata: parsed.frontmatter,
          content: parsed.body,
          syncedAt: new Date().toISOString(),
          commitSha
        };
        
        await this.env.KNOWLEDGE.put(
          toR2Key(contentType, id),
          JSON.stringify(r2Doc)
        );
      });
    }

    for (const filePath of deletedFiles) {
      await step.do(`delete-${filePath}`, async () => {
        const id = generateId(filePath);
        const contentType = inferContentType(filePath);
        await this.env.KNOWLEDGE.delete(toR2Key(contentType, id));
      });
    }
  }
}
```

### 5.3 R2 Event Notifications → Queue Consumer

```typescript
export default {
  async queue(batch: MessageBatch<R2EventNotification>, env: Env) {
    for (const msg of batch.messages) {
      const { object, eventType } = msg.body;
      
      if (!object.key.startsWith('content/')) {
        msg.ack();
        continue;
      }
      
      if (eventType === 'object-create') {
        const doc = await env.KNOWLEDGE.get(object.key);
        if (doc) {
          const r2Doc: R2Document = await doc.json();
          await updateVectorize(r2Doc, env);
        }
      } else if (eventType === 'object-delete') {
        const id = extractIdFromKey(object.key);
        await deleteFromVectorize(id, env);
      }
      
      msg.ack();
    }
  }
};

async function updateVectorize(doc: R2Document, env: Env): Promise<void> {
  const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [doc.content]
  });
  
  const metadata = {
    contentType: doc.contentType,
    group: doc.metadata.group || '',
    tags: (doc.metadata.tags || []).join(','),
    release: doc.metadata.release || '',
    status: doc.metadata.status || '',
    date: new Date(doc.metadata.date).getTime(),
    path: toR2Key(doc.contentType, doc.id),
    title: doc.metadata.title,
    description: doc.metadata.description || '',
    content: truncateForMetadata(doc.content),
  };
  
  await env.VECTORIZE.upsert([{
    id: doc.id,
    values: embedding.data[0],
    metadata
  }]);
}

async function deleteFromVectorize(id: string, env: Env): Promise<void> {
  await env.VECTORIZE.deleteByIds([id]);
}
```

---

## 6. Retrieval System

### 6.1 Two-Stage Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. VECTOR SEARCH                                                        │
│    Query → Embed → Vectorize.query(filter, topK: 20)                   │
│    Returns: 20 matches with metadata (including content snippet)        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. RERANK                                                               │
│    Query + metadata.content → bge-reranker-base → top 5                │
│    Uses content snippet from metadata (no R2 fetch needed)              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. DOCUMENT FETCH                                                       │
│    top 5 IDs → R2.get(metadata.path) → full documents                  │
│    Concurrent fetches, only for final results                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Vector Search with Filters

```typescript
async function searchWithFilters(
  query: string,
  filters: SearchFilters,
  env: Env
): Promise<VectorizeMatch[]> {
  const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [query]
  });

  const vectorFilter: VectorizeVectorMetadataFilter = {};
  
  if (filters.contentType) vectorFilter.contentType = { $eq: filters.contentType };
  if (filters.group) vectorFilter.group = { $eq: filters.group };
  if (filters.release) vectorFilter.release = { $eq: filters.release };
  if (filters.status) vectorFilter.status = { $eq: filters.status };
  if (filters.tags) vectorFilter.tags = { $in: filters.tags };

  const results = await env.VECTORIZE.query(embedding.data[0], {
    topK: 20,
    returnMetadata: 'all',
    filter: Object.keys(vectorFilter).length > 0 ? vectorFilter : undefined
  });

  return results.matches;
}
```

### 6.3 Reranking

```typescript
async function rerankResults(
  query: string,
  matches: VectorizeMatch[],
  env: Env
): Promise<RerankResult[]> {
  if (matches.length === 0) return [];
  
  const cacheKey = `rerank:${hashQuery(query, matches.map(m => m.id))}`;
  const cached = await env.RERANK_CACHE.get(cacheKey, 'json');
  if (cached) return cached as RerankResult[];

  const contexts = matches.map(m => ({
    text: m.metadata?.content as string || m.metadata?.description as string || ''
  }));

  const result = await env.AI.run('@cf/baai/bge-reranker-base', {
    query,
    contexts,
    top_k: 5
  });

  const ranked: RerankResult[] = result.response.map(r => ({
    id: matches[r.id].id,
    score: matches[r.id].score,
    rerankScore: r.score,
    metadata: matches[r.id].metadata as VectorMetadata
  }));

  await env.RERANK_CACHE.put(cacheKey, JSON.stringify(ranked), {
    expirationTtl: 3600
  });

  return ranked;
}
```

### 6.4 Full Document Retrieval

```typescript
async function getDocuments(
  results: RerankResult[],
  env: Env
): Promise<R2Document[]> {
  const docs = await Promise.all(
    results.map(async (result) => {
      const path = result.metadata.path as string;
      if (!path) return null;
      const obj = await env.KNOWLEDGE.get(path);
      if (!obj) return null;
      return obj.json() as Promise<R2Document>;
    })
  );
  return docs.filter((d): d is R2Document => d !== null);
}

async function getDocument(
  contentType: ContentType,
  id: string,
  env: Env
): Promise<R2Document | null> {
  const key = toR2Key(contentType, id);
  const obj = await env.KNOWLEDGE.get(key);
  if (!obj) return null;
  return obj.json();
}
```

### 6.5 Search Orchestrator

```typescript
export async function searchKnowledge(
  query: string,
  filters: SearchFilters,
  options: { includeDocuments?: boolean } = {},
  env: Env
): Promise<SearchResult[]> {
  const matches = await searchWithFilters(query, filters, env);
  if (matches.length === 0) return [];
  
  const ranked = await rerankResults(query, matches, env);
  
  let documents: R2Document[] = [];
  if (options.includeDocuments) {
    documents = await getDocuments(ranked, env);
  }
  
  return ranked.map((r, i) => ({
    id: r.id,
    contentType: r.metadata.contentType as ContentType,
    title: r.metadata.title as string,
    description: r.metadata.description as string,
    score: r.score,
    rerankScore: r.rerankScore,
    document: documents[i]
  }));
}
```

---

## 7. MCP Server

### 7.1 MCP Primitives Overview

| Primitive | Controlled By | Purpose |
|-----------|---------------|---------|
| **Tools** | AI model | Callable functions the AI autonomously invokes |
| **Resources** | Application | Read-only data clients inject as context |
| **Prompts** | User | Workflow templates users explicitly invoke |

### 7.2 Server Implementation

Phase 1 uses stateless `createMcpHandler`. MCP requests go directly to the handler, bypassing Hono:

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

### 7.3 Router Integration

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

### 7.4 Tools

**Access control pattern (porch framework):**

```typescript
// Every tool uses this pattern
server.tool('tool_name', 'description', { /* schema */ },
  async (params) => {
    const authContext = await resolveAuthContext(env);
    const access = checkTierAccess('open', authContext);
    if (!access.allowed) {
      return {
        content: [{ type: 'text', text: `Requires ${access.requiredTier} access. Current: ${access.currentTier}.` }],
        isError: true,
      };
    }
    // ... tool logic
  }
);
```

**Tool Registration:**

```typescript
function registerTools(server: McpServer, env: Env) {
  // Open tools (Phase 1: all tools are Open)
  server.tool(
    "search_knowledge",
    "Search the SuperBenefit knowledge base for documents about DAO patterns, " +
    "governance practices, regenerative economics, and web3 coordination. " +
    "Returns semantically similar content chunks with metadata.",
    {
      query: z.string().describe("Natural language search query"),
      filters: z.object({
        contentType: ContentTypeSchema.optional()
          .describe("Filter by content type (pattern, tag, article, etc.)"),
        group: z.string().optional()
          .describe("Filter by group/cell (dao-primitives, allinforsport)"),
        release: z.string().optional()
          .describe("Filter by creative release"),
        limit: z.number().min(1).max(20).default(5)
          .describe("Maximum results to return"),
      }).optional(),
    },
    async ({ query, filters }) => {
      const authContext = await resolveAuthContext(env);
      const access = checkTierAccess('open', authContext);
      if (!access.allowed) {
        return { content: [{ type: "text", text: `Requires ${access.requiredTier} access.` }], isError: true };
      }
      const results = await searchKnowledge(query, filters || {}, {}, env);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "define_term",
    "Get the definition of a term from the SuperBenefit lexicon. " +
    "Use this when users ask 'what is X?' for DAO/web3 terminology.",
    { term: z.string().describe("Term to define") },
    async ({ term }) => {
      const authContext = await resolveAuthContext(env);
      const access = checkTierAccess('open', authContext);
      if (!access.allowed) {
        return { content: [{ type: "text", text: `Requires ${access.requiredTier} access.` }], isError: true };
      }
      const definition = await getTermDefinition(term, env);
      return {
        content: [{
          type: "text",
          text: definition || `Term "${term}" not found in lexicon.`
        }]
      };
    }
  );

  server.tool(
    "search_lexicon",
    "Search lexicon entries by keyword. Returns matching terms with definitions.",
    { keyword: z.string().describe("Keyword to search") },
    async ({ keyword }) => {
      const authContext = await resolveAuthContext(env);
      const access = checkTierAccess('open', authContext);
      if (!access.allowed) {
        return { content: [{ type: "text", text: `Requires ${access.requiredTier} access.` }], isError: true };
      }
      const results = await searchLexicon(keyword, env);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "list_groups",
    "List all groups/cells in the SuperBenefit ecosystem.",
    {},
    async () => {
      const authContext = await resolveAuthContext(env);
      const access = checkTierAccess('open', authContext);
      if (!access.allowed) {
        return { content: [{ type: "text", text: `Requires ${access.requiredTier} access.` }], isError: true };
      }
      const groups = await listGroups(env);
      return { content: [{ type: "text", text: JSON.stringify(groups, null, 2) }] };
    }
  );

  server.tool(
    "list_releases",
    "List creative releases with their metadata.",
    {},
    async () => {
      const authContext = await resolveAuthContext(env);
      const access = checkTierAccess('open', authContext);
      if (!access.allowed) {
        return { content: [{ type: "text", text: `Requires ${access.requiredTier} access.` }], isError: true };
      }
      const releases = await listReleases(env);
      return { content: [{ type: "text", text: JSON.stringify(releases, null, 2) }] };
    }
  );

  server.tool(
    "get_document",
    "Get the full content of a document by its contentType and ID. " +
    "Requires members access (Phase 3).",
    {
      contentType: ContentTypeSchema.describe("Content type of the document"),
      id: z.string().describe("Document ID"),
    },
    async ({ contentType, id }) => {
      const authContext = await resolveAuthContext(env);
      // Phase 1: temporarily 'open'; will become 'members' in Phase 3
      const access = checkTierAccess('open', authContext);
      if (!access.allowed) {
        return { content: [{ type: "text", text: `Requires ${access.requiredTier} access.` }], isError: true };
      }
      const doc = await getDocument(contentType, id, env);
      if (!doc) {
        return { content: [{ type: "text", text: "Document not found" }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(doc, null, 2) }] };
    }
  );

  server.tool(
    "search_with_documents",
    "Search and return full document content for results. " +
    "Requires members access (Phase 3).",
    {
      query: z.string().describe("Search query"),
      filters: SearchFiltersSchema.optional(),
    },
    async ({ query, filters }) => {
      const authContext = await resolveAuthContext(env);
      // Phase 1: temporarily 'open'; will become 'members' in Phase 3
      const access = checkTierAccess('open', authContext);
      if (!access.allowed) {
        return { content: [{ type: "text", text: `Requires ${access.requiredTier} access.` }], isError: true };
      }
      const results = await searchKnowledge(query, filters || {}, { includeDocuments: true }, env);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }
  );
}
```

### 7.5 Resources

```typescript
function registerResources(server: McpServer, env: Env) {
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

  server.resource(
    "data/releases",
    "mcp://superbenefit/data/releases",
    {
      description: "List of creative releases with metadata",
      mimeType: "application/json"
    },
    async () => {
      const releases = await listReleases(env);
      return {
        contents: [{
          uri: "mcp://superbenefit/data/releases",
          mimeType: "application/json",
          text: JSON.stringify(releases, null, 2)
        }]
      };
    }
  );
}
```

### 7.6 Prompts

```typescript
function registerPrompts(server: McpServer, env: Env) {
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

  server.prompt(
    "explain-pattern",
    "Explain a DAO pattern with examples and context from SuperBenefit's experience",
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

### 7.7 Tool Inventory Summary

| Tool | Description | Phase 1 Tier | Target Tier |
|------|-------------|--------------|-------------|
| `search_knowledge` | Semantic search across knowledge base | Open | Open |
| `define_term` | Get lexicon definition | Open | Open |
| `search_lexicon` | Search lexicon entries | Open | Open |
| `list_groups` | List groups/cells | Open | Open |
| `list_releases` | List creative releases | Open | Open |
| `get_document` | Get full document by ID | Open* | Members |
| `search_with_documents` | Search with full documents | Open* | Members |

*Temporarily Open in Phase 1; will gate to Members tier when porch Phase 3 enables authorization.

> **Removed in v0.12**: `save_link` and `create_draft` tools — write operations deferred to Phase 2+ when stateful agents with `needsApproval` are available.

### 7.8 Client Compatibility

| Client | Transport | Auth | Resources | Prompts |
|--------|-----------|------|-----------|---------|
| Claude Desktop | SSE (via mcp-remote) | N/A (Phase 1) | ✅ | ✅ |
| Claude Code | Streamable HTTP | N/A (Phase 1) | ✅ | ✅ |
| Cursor | Streamable HTTP | N/A (Phase 1) | ⚠️ Limited | ⚠️ Limited |
| Windsurf | Streamable HTTP | N/A (Phase 1) | ⚠️ Limited | ⚠️ Limited |
| VS Code | Streamable HTTP | N/A (Phase 1) | ✅ | ✅ |
| MCP Inspector | Streamable HTTP | N/A (Phase 1) | ✅ | ✅ |
| Workers AI Playground | Streamable HTTP | N/A (Phase 1) | ⚠️ Unknown | ⚠️ Unknown |

---

## 8. Public REST API

### 8.1 OpenAPI Configuration

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const api = new OpenAPIHono<{ Bindings: Env }>();

api.use('*', cors({
  origin: '*',
  methods: ['GET', 'HEAD', 'OPTIONS'],
  maxAge: 86400
}));

const cacheHeaders = {
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600'
};
```

### 8.2 Endpoints

**GET /api/v1/entries**

```typescript
const listEntriesRoute = createRoute({
  method: 'get',
  path: '/entries',
  request: {
    query: z.object({
      contentType: ContentTypeSchema.optional(),
      group: z.string().optional(),
      release: z.string().optional(),
      limit: z.coerce.number().min(1).max(100).default(20),
      offset: z.coerce.number().min(0).default(0),
    })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ListEntriesResponseSchema } },
      description: 'List of entries'
    }
  }
});
```

**GET /api/v1/entries/{contentType}/{id}**

```typescript
const getEntryRoute = createRoute({
  method: 'get',
  path: '/entries/{contentType}/{id}',
  request: {
    params: z.object({
      contentType: ContentTypeSchema,
      id: z.string()
    })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: R2DocumentSchema } },
      description: 'Full document'
    },
    404: { description: 'Entry not found' }
  }
});
```

**GET /api/v1/search**

```typescript
const searchRoute = createRoute({
  method: 'get',
  path: '/search',
  request: {
    query: z.object({
      q: z.string().min(1),
      contentType: ContentTypeSchema.optional(),
      group: z.string().optional(),
      release: z.string().optional(),
      limit: z.coerce.number().min(1).max(20).default(5),
    })
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SearchResponseSchema } },
      description: 'Search results'
    }
  }
});
```

**GET /api/v1/openapi.json**

Auto-generated from route definitions.

---

## 9. Future Phases

### 9.1 Phase 2: Stateful Services + Public Tier

**Architecture:** `AIChatAgent` (Durable Object) + AI SDK `tool()` function

**Access:** Public tier via Cloudflare Access for SaaS (see `porch-spec.md` Phase 2)

```typescript
import { AIChatAgent } from "agents/ai-chat-agent";
import { streamText, tool } from "ai";

export class KnowledgeChatAgent extends AIChatAgent<Env> {
  
  tools = {
    searchKnowledge: tool({
      description: "Search SuperBenefit knowledge base",
      inputSchema: z.object({
        query: z.string(),
        filters: SearchFiltersSchema.optional(),
      }),
      execute: async ({ query, filters }) => {
        return await searchVectorize(query, filters, this.env);
      }
    }),
    
    createDraft: tool({
      description: "Create a draft document",
      inputSchema: z.object({
        title: z.string(),
        contentType: ContentTypeSchema,
        body: z.string(),
      }),
      needsApproval: async () => true,
      execute: async (params) => {
        return await createGitHubPR(params, this.env);
      }
    }),
  };

  async onChatMessage(onFinish) {
    const result = streamText({
      model: workersai("@cf/meta/llama-3-8b-instruct"),
      system: KNOWLEDGE_AGENT_SYSTEM_PROMPT,
      messages: this.messages,
      tools: this.tools,
      maxSteps: 5,
    });

    return result.toUIMessageStreamResponse();
  }
}
```

### 9.2 Phase 3: Knowledge Commons + Members Tier

**Architecture:** `Agent` as MCP Client connecting to partner DAOs

**Access:** Members tier via Hats Protocol / token gating (see `porch-spec.md` Phase 3)

```typescript
import { Agent } from "agents";
import { streamText } from "ai";

export class CommonsAgent extends Agent<Env> {
  
  partnerServers = [
    { name: "SuperBenefit", url: "https://porch.superbenefit.dev/mcp" },
    { name: "DAO Primitives", url: "https://mcp.daoprim.xyz/mcp" },
    { name: "Commons Stack", url: "https://mcp.commonsstack.org/mcp" },
  ];

  async onStart() {
    for (const server of this.partnerServers) {
      const result = await this.addMcpServer(server.name, server.url);
      if (result.state === "authenticating") {
        this.setState({ pendingAuth: result.authUrl });
      }
    }
  }

  async onRequest(request: Request) {
    const partnerTools = this.mcp.getAITools();
    const servers = this.getMcpServers();
    
    const result = await streamText({
      model: workersai("@cf/meta/llama-3-70b-instruct"),
      system: `You have access to knowledge from multiple DAO ecosystems:
${Object.values(servers.servers).map(s => `- ${s.name}`).join('\n')}

Search across ALL sources to provide comprehensive analysis.`,
      prompt: await request.text(),
      tools: partnerTools,
      maxSteps: 10,
    });

    return new Response(result.text);
  }
}
```

---

## 10. Error Handling

```typescript
export class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export const errorHandler = (err: Error, c: Context) => {
  console.error('API Error:', err);
  
  if (err instanceof APIError) {
    return c.json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    }, err.status);
  }
  
  return c.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  }, 500);
};
```

---

## 11. Infrastructure

### 11.1 Cloudflare Resources

| Resource | Name | Purpose |
|----------|------|---------|
| Worker | `superbenefit-knowledge` | Main application |
| R2 Bucket | `superbenefit-knowledge` | Document storage |
| Vectorize Index | `superbenefit-knowledge-idx` | Vector search |
| Queue | `superbenefit-knowledge-sync` | Event processing |
| KV Namespace | `ROLE_CACHE` | Hats roles (dormant) |
| KV Namespace | `ENS_CACHE` | ENS resolution (dormant) |
| KV Namespace | `RERANK_CACHE` | Rerank results |
| KV Namespace | `SYNC_STATE` | Sync metadata |

### 11.2 Setup Commands

```bash
# Create R2 bucket
npx wrangler r2 bucket create superbenefit-knowledge

# Create Vectorize index
npx wrangler vectorize create superbenefit-knowledge-idx \
  --dimensions=768 --metric=cosine

# Create metadata indexes (MUST be done before inserting vectors)
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

### 11.3 Environment Variables

```
# Required secrets (set via wrangler secret put)
GITHUB_TOKEN=<fine_grained_pat>
GITHUB_WEBHOOK_SECRET=<webhook_secret>

# Dormant secrets (needed for Phase 3)
MAINNET_RPC_URL=<ethereum_mainnet_rpc>
OPTIMISM_RPC_URL=<optimism_rpc>

# Phase 2 addition
# CF_ACCESS_AUD=<access_application_audience_tag>
```

---

## Appendix A: Worker Configuration

```jsonc
// wrangler.jsonc
{
  "name": "superbenefit-knowledge",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-01",
  
  "r2_buckets": [{
    "binding": "KNOWLEDGE",
    "bucket_name": "superbenefit-knowledge"
  }],
  
  "vectorize": [{
    "binding": "VECTORIZE",
    "index_name": "superbenefit-knowledge-idx"
  }],
  
  "queues": {
    "consumers": [{
      "queue": "superbenefit-knowledge-sync",
      "max_batch_size": 10,
      "max_batch_timeout": 30
    }]
  },
  
  "kv_namespaces": [
    { "binding": "ROLE_CACHE", "id": "<kv_id>" },
    { "binding": "ENS_CACHE", "id": "<kv_id>" },
    { "binding": "RERANK_CACHE", "id": "<kv_id>" },
    { "binding": "SYNC_STATE", "id": "<kv_id>" }
  ],
  
  "ai": {
    "binding": "AI"
  },
  
  "workflows": [{
    "name": "knowledge-sync",
    "binding": "SYNC_WORKFLOW",
    "class_name": "KnowledgeSyncWorkflow"
  }]
}
```

---

## Appendix B: Type Definitions

```typescript
// src/env.d.ts
interface Env {
  // Bindings
  KNOWLEDGE: R2Bucket;
  VECTORIZE: Vectorize;
  AI: Ai;
  SYNC_WORKFLOW: Workflow;
  
  // KV (active)
  RERANK_CACHE: KVNamespace;
  SYNC_STATE: KVNamespace;
  
  // KV (dormant — Phase 3)
  ROLE_CACHE: KVNamespace;
  ENS_CACHE: KVNamespace;
  
  // Secrets (active)
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET: string;
  
  // Secrets (dormant — Phase 3)
  MAINNET_RPC_URL: string;
  OPTIMISM_RPC_URL: string;
  
  // Config
  GITHUB_REPO: string;
  
  // Phase 2 addition
  CF_ACCESS_AUD?: string;
}
```

---

## Appendix C: Vectorize Limits Reference

| Limit | Value | Notes |
|-------|-------|-------|
| Metadata per vector | 10 KiB | Must fit all indexed + non-indexed fields |
| Vector ID length | 64 bytes | Keep IDs short |
| Indexed string filtering | First 64 bytes | Longer values truncated for filtering |
| topK with metadata | 20 max | Use for reranking stage |
| topK without metadata | 100 max | For bulk operations |
| Metadata indexes | 10 per index | We use 6 of 10 |
| Dimensions | 1,536 max | We use 768 (bge-base-en-v1.5) |
| Vectors per index | 10,000,000 | Recently increased from 5M |

---

## Appendix D: Dependencies

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

> **Removed in v0.12**: `workers-oauth-provider` — no longer a Worker dependency. Phase 2 auth handled by Cloudflare Access for SaaS at the infrastructure layer.

---

## Appendix E: Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.12 | 2026-02-06 | Porch framework: replaced OAuthProvider with authContext injection, new tier model (open/public/members), routing split (MCP direct, REST through Hono), removed OAUTH_KV/NONCE_KV, removed workers-oauth-provider dependency, validated against Feb 2026 Cloudflare docs, added MCP Server Portals reference |
| 0.11 | 2026-02-01 | MCP primitives: stateless createMcpHandler pattern, Resources section, Prompts section, permission wrapper pattern, client compatibility matrix, Phase 2/3 architecture, updated dependencies |
| 0.10 | 2026-02-01 | ID-based retrieval pattern: documented Vector→R2 mapping, metadata structure for reranking, content truncation strategy, retrieval flow stages |
| 0.9 | 2026-02-01 | Ontology alignment: file type hierarchy, updated schemas, Vectorize indexes, prerequisites section |
| 0.8 | 2026-01-30 | Initial MCP + REST API architecture, authentication, sync layer |