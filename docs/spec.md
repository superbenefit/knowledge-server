# SuperBenefit AI Tools Infrastructure Specification

**Version:** 0.11  
**Date:** February 1, 2026

---

## 1. Overview

### 1.1 Purpose

This specification defines the architecture for SuperBenefit's AI tools infrastructure. The system enables DAO members to access curated AI tools through a unified MCP interface, backed by a synchronized knowledge base from GitHub and authenticated via Ethereum wallets. A public REST API provides unauthenticated read access for external consumers and web integrations.

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
3. **Ethereum-native identity** — SIWE authentication, Hats Protocol authorization
4. **R2 as canonical store** — GitHub syncs to R2; consumers read from R2
5. **Event-driven updates** — R2 notifications trigger consumer updates
6. **Two-stage retrieval** — Metadata filtering + reranking for quality
7. **ID-based document lookup** — Vector ID maps directly to R2 object key
8. **Dual interface** — MCP for AI tools, REST for web/external access
9. **Schema-first** — Single source of truth for content types across all consumers
10. **Phased evolution** — Stateless tools → Stateful agents → Federation

### 1.4 Key Architectural Decisions

**Why Native SIWE (not OAuth-only)?**
- Ethereum addresses are SuperBenefit's canonical identifiers
- Direct integration with Hats Protocol authorization
- WaaP provides email/social fallback for users without wallets
- Zero recurring third-party costs

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
- Decouples MCP protocol from OAuth provider
- Easier to test and reason about
- Upgrade path to stateful `Agent` class for Phase 2 when needed

### 1.5 Reference Implementations

| Component | Official Reference |
|-----------|-------------------|
| createMcpHandler + OAuth | `npm create cloudflare@latest -- --template=cloudflare/ai/demos/remote-mcp-server` |
| McpAgent (legacy/stateful) | `npm create cloudflare@latest -- --template=cloudflare/ai/demos/remote-mcp-github-oauth` |
| Workflows | `npm create cloudflare@latest -- --template=cloudflare/workflows-starter` |
| R2 Events | [developers.cloudflare.com/r2/tutorials/upload-logs-event-notifications](https://developers.cloudflare.com/r2/tutorials/upload-logs-event-notifications/) |
| SIWE | [github.com/spruceid/siwe-oidc](https://github.com/spruceid/siwe-oidc) |
| Hono OpenAPI | [github.com/honojs/middleware/tree/main/packages/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) |
| RAG Tutorial | [developers.cloudflare.com/workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai/) |
| AIChatAgent | [developers.cloudflare.com/agents/api-reference/agents-api](https://developers.cloudflare.com/agents/api-reference/agents-api/) |
| MCP Client API | [developers.cloudflare.com/agents/model-context-protocol/mcp-client-api](https://developers.cloudflare.com/agents/model-context-protocol/mcp-client-api/) |

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
│  Application Layer (mcp.superbenefit.xyz)                                │
│                                                                          │
│  Public REST API (no auth, CORS enabled)                                 │
│  ├── /api/v1/entries         → List/filter entries                       │
│  ├── /api/v1/entries/{id}    → Get single entry                          │
│  ├── /api/v1/search          → Semantic search                           │
│  └── /api/v1/openapi.json    → OpenAPI specification                     │
│                                                                          │
│  MCP Server (OAuth/SIWE protected)                                       │
│  ├── /authorize → SIWE Auth Handler (WaaP UI)                            │
│  ├── /siwe/nonce → Nonce generation                                      │
│  ├── /siwe/verify → Signature verification + Hats lookup                 │
│  ├── /token → OAuth token exchange                                       │
│  ├── /mcp → createMcpHandler (Tools, Resources, Prompts)                 │
│  └── /register → Dynamic Client Registration                             │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.7 Phased Architecture

| Phase | Focus | Architecture | MCP Primitives |
|-------|-------|--------------|----------------|
| **1. Foundation** | Search, retrieval, API | Stateless `createMcpHandler` | Tools (primary), Resources, Prompts |
| **2. Stateful Services** | AI chat, knowledge agents, automated PRs | `AIChatAgent` + AI SDK `tool()` | Tools with `needsApproval` |
| **3. Knowledge Commons** | Multi-DAO federation, cross-source analysis | `Agent` as MCP Client | `addMcpServer()`, `getAITools()` |

---

## 2. Authentication & Authorization

### 2.1 Identity Model

| Layer | Source | Purpose |
|-------|--------|---------|
| **Primary ID** | Ethereum Address | Universal identifier |
| **Profile** | ENS Text Records | Name, avatar, GitHub handle |
| **Authorization** | Hats Protocol (Optimism) | Role badges for access control |

### 2.2 Authentication Flow

```
MCP Client → /authorize → Auth Page (WaaP) → SIWE Sign
  → /siwe/verify → Hats Check (Optimism) → ENS Resolve (Mainnet)
  → OAuth Token with { address, tier, ensName, ... }
```

**Key insight:** workers-oauth-provider is **authentication-agnostic**. SIWE integration works via a custom `defaultHandler` that presents the challenge, verifies signatures, then calls `completeAuthorization()` with the wallet address as `userId`.

### 2.3 WaaP Integration (UI Client)

> **Note:** WaaP is a **frontend wallet SDK** that runs in the browser. The knowledge-server serves an auth page that loads WaaP; the Worker itself only handles SIWE verification.

| Auth Method | User Type | How It Works |
|-------------|-----------|--------------|
| Wallet | Web3 natives | Browser wallets (MetaMask, etc.) via WaaP's EIP-1193 interface |
| Email | Newcomers | WaaP creates MPC wallet (2PC with Ika network) |
| Social | Newcomers | GitHub/Discord/Google → MPC wallet via WaaP |

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│ UI Client (Browser)                                             │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ WaaP SDK (@human.tech/waap-sdk)                             │ │
│ │ - window.waap.login() → user authenticates                  │ │
│ │ - window.waap.request({ method: 'personal_sign', ... })     │ │
│ │   → signs SIWE message                                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │ POST /siwe/verify
                               │ { message, signature }
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ Knowledge Server (Cloudflare Worker)                            │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ viem/siwe (verifySiweMessage)                               │ │
│ │ - Verifies signature matches address                        │ │
│ │ - Validates nonce, domain, timestamp                        │ │
│ │ - Issues OAuth token with address as userId                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Auth Page (served by Worker at /authorize):**

The Worker serves a static HTML page that loads WaaP:

```html
<!-- Served by Worker at /authorize -->
<script type="module">
  import { initWaaP } from 'https://cdn.jsdelivr.net/npm/@human.tech/waap-sdk/+esm';
  
  initWaaP({
    config: {
      authenticationMethods: ['wallet', 'email', 'social'],
      allowedSocials: ['github', 'discord', 'google'],
      styles: { darkMode: true }
    },
    project: {
      name: 'SuperBenefit',
      entryTitle: 'Sign in to SuperBenefit AI Tools'
    }
  });
  
  // After WaaP login, sign SIWE message and POST to /siwe/verify
  async function authenticate() {
    await window.waap.login();
    const [address] = await window.waap.request({ method: 'eth_requestAccounts' });
    
    // Get nonce from server
    const { nonce } = await fetch('/siwe/nonce').then(r => r.json());
    
    // Create and sign SIWE message
    const message = createSiweMessage({ address, nonce, ... });
    const signature = await window.waap.request({
      method: 'personal_sign',
      params: [message, address]
    });
    
    // Verify on server
    const result = await fetch('/siwe/verify', {
      method: 'POST',
      body: JSON.stringify({ message, signature })
    });
  }
</script>
```

**Server-side verification (in Worker):**

```typescript
import { verifySiweMessage, parseSiweMessage } from 'viem/siwe';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

// viem/siwe works in edge runtime (no Buffer issues like siwe npm package)
async function verifySIWE(message: string, signature: `0x${string}`) {
  const client = createPublicClient({ chain: mainnet, transport: http() });
  
  const valid = await verifySiweMessage(client, { message, signature });
  if (!valid) throw new Error('Invalid signature');
  
  const parsed = parseSiweMessage(message);
  return parsed.address;
}
```

### 2.4 Hats Protocol Configuration

| Setting | Value |
|---------|-------|
| Chain | Optimism (10) |
| Contract | `0x3bc1A0Ad72417f2d411118085256fC53CBdDd137` |
| Tree ID | 30 |

| Hat Path | Role | Access Tier |
|----------|------|-------------|
| `30.3.1` | Contributor | `vibecoder` |
| `30.3.5` | Basic Member | `member` |
| (none) | Public | `public` |

```typescript
import { treeIdToHatId } from '@hatsprotocol/sdk-v1-core';

const HATS = {
  contributor: treeIdToHatId(30, [3, 1]),
  member: treeIdToHatId(30, [3, 5])
};

async function checkHatsRoles(address: `0x${string}`, client: PublicClient) {
  const [isContributor, isMember] = await Promise.all([
    client.readContract({
      address: HATS_CONTRACT,
      abi: HATS_ABI,
      functionName: 'isWearerOfHat',
      args: [address, HATS.contributor]
    }),
    client.readContract({
      address: HATS_CONTRACT,
      abi: HATS_ABI,
      functionName: 'isWearerOfHat',
      args: [address, HATS.member]
    })
  ]);

  return {
    isContributor,
    isMember,
    tier: isContributor ? 'vibecoder' : isMember ? 'member' : 'public'
  };
}
```

### 2.5 Token Lifecycle

| Setting | Value |
|---------|-------|
| Access Token TTL | 1 hour |
| Refresh Token TTL | 30 days |
| Role Cache TTL | 5 minutes |

```typescript
const oauthProvider = new OAuthProvider({
  apiRoute: '/mcp',
  apiHandler: McpHandler,
  defaultHandler: SIWEHandler,
  refreshTokenTTL: 2592000,
  
  tokenExchangeCallback: async ({ props, grantType }) => {
    if (grantType === 'refresh_token') {
      const roles = await checkHatsRoles(props.address, client);
      const newTier = roles.isContributor ? 'vibecoder'
                    : roles.isMember ? 'member' : 'public';
      return {
        accessTokenProps: { ...props, roles, tier: newTier },
        newProps: { ...props, roles, tier: newTier }
      };
    }
    return {};
  }
});
```

### 2.6 SIWE Verification

**Critical:** Use `viem/siwe` utilities, NOT the standalone `siwe` package (has Buffer API dependencies that break in edge runtimes).

```typescript
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { parseSiweMessage, generateSiweNonce, verifySiweMessage } from 'viem/siwe';

// Nonce management
async function createNonce(env: Env): Promise<string> {
  const nonce = generateSiweNonce();
  await env.NONCE_KV.put(nonce, 'pending', { expirationTtl: 300 });
  return nonce;
}

async function validateNonce(nonce: string, env: Env): Promise<boolean> {
  const value = await env.NONCE_KV.get(nonce);
  if (!value) return false;
  await env.NONCE_KV.delete(nonce); // Single-use
  return true;
}

// Verification with EIP-1271 support for smart contract wallets
const publicClient = createPublicClient({ 
  chain: mainnet, 
  transport: http(env.MAINNET_RPC_URL) 
});

async function verifySIWE(message: string, signature: `0x${string}`): Promise<boolean> {
  return publicClient.verifySiweMessage({
    message,
    signature,
    blockTag: 'safe' // Required for EIP-1271 smart contract wallet verification
  });
}
```

### 2.7 SIWE Handler Integration

```typescript
const SIWEHandler = {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    
    if (url.pathname === '/siwe/nonce') {
      const nonce = await createNonce(env);
      return Response.json({ nonce });
    }
    
    if (url.pathname === '/siwe/verify' && request.method === 'POST') {
      const { message, signature, stateId } = await request.json();
      const siweMessage = parseSiweMessage(message);
      
      // Verify nonce (single-use)
      if (!await validateNonce(siweMessage.nonce, env)) {
        return Response.json({ error: 'Invalid nonce' }, { status: 400 });
      }
      
      // Verify signature
      const valid = await verifySIWE(message, signature);
      if (!valid) {
        return Response.json({ error: 'Invalid signature' }, { status: 401 });
      }
      
      // Fetch roles and ENS
      const [roles, ens] = await Promise.all([
        checkHatsRoles(siweMessage.address, optimismClient),
        resolveENS(siweMessage.address, mainnetClient)
      ]);
      
      // Complete OAuth flow
      const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
        request: oauthReqInfo,
        userId: siweMessage.address,
        props: {
          address: siweMessage.address,
          roles,
          tier: roles.isContributor ? 'vibecoder' : roles.isMember ? 'member' : 'public',
          ensName: ens.name,
          chainId: 1
        }
      });
      
      return Response.json({ redirectTo });
    }
    
    // Fall through to auth page
    return renderAuthPage(request);
  }
};
```

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
  // Resources
  'artifacts/patterns': 'pattern',
  'artifacts/practices': 'practice',
  'artifacts/primitives': 'primitive',
  'artifacts/protocols': 'protocol',
  'artifacts/playbooks': 'playbook',
  'artifacts/questions': 'question',
  'artifacts/studies': 'study',
  'artifacts/articles': 'article',
  // Data
  'data/people': 'person',
  'data/groups': 'group',
  'data/projects': 'project',
  'data/places': 'place',
  'data/gatherings': 'gathering',
  // Reference
  'links': 'link',
  'tags': 'tag',
  // File
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
  type: ContentTypeSchema.optional(),  // Inferred from path if not specified
  title: z.string().min(1),
  description: z.string().optional(),
  date: z.coerce.date(),
  publish: z.boolean().default(false),
  draft: z.boolean().default(false),
  permalink: z.string().optional(),
  author: z.array(z.string()).optional(),  // links to person pages
  group: z.string().optional(),            // cell/project slug
});
```

**Parent type schemas**

```typescript
export const ReferenceSchema = FileSchema;  // No additional fields

export const ResourceSchema = FileSchema.extend({
  release: z.string().optional(),           // creative release slug
  hasPart: z.array(z.string()).optional(),  // component resources
  isPartOf: z.array(z.string()).optional(), // parent resources
});

export const StorySchema = FileSchema.extend({
  release: z.string().optional(),
});

export const DataSchema = FileSchema;  // No additional fields
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

export const PlaybookSchema = ResourceSchema;  // No additional fields

export const QuestionSchema = ResourceSchema.extend({
  status: z.enum(['open', 'exploring', 'resolved']).optional(),
  related: z.array(z.string()).optional(),
  proposedBy: z.array(z.string()).optional(),
});

// Story types
export const StudySchema = StorySchema;  // No additional fields

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

Vector IDs (and R2 key stems) are derived from file paths:

```typescript
/**
 * Generate document ID from file path.
 * Example: "artifacts/patterns/cell-governance.md" → "cell-governance"
 * 
 * Constraints:
 * - Max 64 bytes (Vectorize limit)
 * - URL-safe characters only
 * - Unique within contentType namespace
 */
export function generateId(path: string): string {
  const filename = path.split('/').pop() || path;
  const id = filename.replace(/\.md$/, '');
  
  // Ensure ID is under 64 bytes (Vectorize limit)
  if (new TextEncoder().encode(id).length > 64) {
    throw new Error(`ID exceeds 64 byte limit: ${id}`);
  }
  
  return id;
}

/**
 * Construct R2 object key from contentType and ID.
 * Example: ("pattern", "cell-governance") → "content/pattern/cell-governance.json"
 */
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

**Vectorize Limits (critical):**
- Metadata per vector: 10 KiB max
- Vector ID length: 64 bytes max
- Indexed string fields: first 64 bytes indexed for filtering
- topK with metadata: 20 max
- topK without metadata: 100 max
- Metadata indexes per index: 10 max

**Indexed Metadata (6 of 10 max):**

Only published content is synced (`publish: true` AND `draft: false`), so those fields aren't needed as indexes.

| Field | Type | Purpose |
|-------|------|---------|
| `contentType` | string | Filter by type (pattern, tag, etc.) |
| `group` | string | Filter by cell/project |
| `tags` | string | Filter by tags (comma-separated) |
| `release` | string | Filter by creative release |
| `status` | string | Filter projects by status |
| `date` | number | Sort by date (Unix timestamp ms) |

**Non-indexed Metadata (for retrieval/reranking):**

Stored in metadata but NOT indexed (within 10 KiB total limit):

| Field | Purpose | Size estimate |
|-------|---------|---------------|
| `path` | R2 object key for document fetch | ~100 bytes |
| `title` | Display, reranking context | ~100 bytes |
| `description` | Display, reranking context | ~500 bytes |
| `content` | Truncated body for reranking | ~8,000 bytes |

**Critical constraint:** Metadata indexes must be created **before** inserting vectors. Vectors inserted prior to index creation will not be filterable.

### 4.4 Vector Structure

```typescript
interface VectorRecord {
  id: string;                    // Document ID (e.g., "cell-governance")
  values: number[];              // 768-dimensional embedding
  metadata: {
    // Indexed fields (used for filtering)
    contentType: string;         // "pattern", "tag", etc.
    group: string;               // "dao-primitives", "all-in-for-sport"
    tags: string;                // "governance,cells,coordination"
    release: string;             // "v1", "2024-q1"
    status: string;              // "active", "completed" (projects only)
    date: number;                // Unix timestamp ms (1706745600000)
    
    // Non-indexed fields (used for retrieval/reranking)
    path: string;                // "content/pattern/cell-governance.json"
    title: string;               // "Cell Governance"
    description: string;         // Short description for display
    content: string;             // Truncated body (~8KB) for reranking
  };
}
```

**Content truncation for metadata:**

```typescript
const MAX_CONTENT_LENGTH = 8000; // ~8KB, leaves room for other fields

export function truncateForMetadata(content: string): string {
  if (content.length <= MAX_CONTENT_LENGTH) return content;
  
  // Truncate at word boundary
  const truncated = content.slice(0, MAX_CONTENT_LENGTH);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.slice(0, lastSpace) + '...';
}
```

### 4.5 KV Namespaces

| Namespace | Purpose | TTL |
|-----------|---------|-----|
| `OAUTH_KV` | OAuth tokens | Managed |
| `NONCE_KV` | SIWE nonces | 5 min |
| `ROLE_CACHE` | Hats roles | 5 min |
| `ENS_CACHE` | ENS resolution | 1 hour |
| `RERANK_CACHE` | Rerank results | 1 hour |
| `SYNC_STATE` | Sync metadata | None |

---

## 5. Sync Layer

### 5.1 GitHub Webhook Handler

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
};
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
        
        if (resp.status === 429) throw new Error('Rate limited'); // Will retry
        if (resp.status === 404) throw new NonRetryableError('File not found'); // Won't retry
        
        const data = await resp.json();
        const content = atob(data.content);
        const parsed = await this.parseMarkdown(content);
        
        // Only sync published, non-draft content
        if (!parsed.frontmatter.publish || parsed.frontmatter.draft) {
          return; // Skip unpublished content
        }
        
        const contentType = inferContentType(filePath);
        const id = generateId(filePath);
        
        // Store full document in R2 (canonical store)
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
// R2 bucket notifications trigger queue messages
export default {
  async queue(batch: MessageBatch<R2EventNotification>, env: Env) {
    for (const msg of batch.messages) {
      const { object, eventType } = msg.body;
      
      // Only process content/ objects
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
  // Generate embedding
  const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [doc.content]
  });
  
  // Prepare metadata (within 10 KiB limit)
  const metadata = {
    // Indexed fields
    contentType: doc.contentType,
    group: doc.metadata.group || '',
    tags: (doc.metadata.tags || []).join(','),
    release: doc.metadata.release || '',
    status: doc.metadata.status || '',
    date: new Date(doc.metadata.date).getTime(),
    
    // Non-indexed fields (for retrieval/reranking)
    path: toR2Key(doc.contentType, doc.id),
    title: doc.metadata.title,
    description: doc.metadata.description || '',
    content: truncateForMetadata(doc.content),
  };
  
  // Upsert to Vectorize
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

**Why this pattern:**
- Stage 1 uses indexed metadata for fast filtering (Vectorize)
- Stage 2 uses content snippet stored in metadata (no R2 round-trip)
- Stage 3 fetches full documents only for final top-K (minimizes latency)

### 6.2 Vector Search with Filters

```typescript
async function searchWithFilters(
  query: string,
  filters: SearchFilters,
  env: Env
): Promise<VectorizeMatch[]> {
  // Generate query embedding
  const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [query]
  });

  // Build Vectorize filter from search filters
  const vectorFilter: VectorizeVectorMetadataFilter = {};
  
  if (filters.contentType) {
    vectorFilter.contentType = { $eq: filters.contentType };
  }
  if (filters.group) {
    vectorFilter.group = { $eq: filters.group };
  }
  if (filters.release) {
    vectorFilter.release = { $eq: filters.release };
  }
  if (filters.status) {
    vectorFilter.status = { $eq: filters.status };
  }
  if (filters.tags) {
    // Tags stored as comma-separated string
    // Use $in for any-match semantics
    vectorFilter.tags = { $in: filters.tags };
  }

  // Query Vectorize with metadata
  const results = await env.VECTORIZE.query(embedding.data[0], {
    topK: 20,  // Max when returnMetadata: 'all'
    returnMetadata: 'all',
    filter: Object.keys(vectorFilter).length > 0 ? vectorFilter : undefined
  });

  return results.matches;
}
```

### 6.3 Reranking

**Critical:** Use batch API pattern, NOT per-document calls.

```typescript
interface RerankResult {
  id: string;
  score: number;           // Original vector similarity
  rerankScore: number;     // Semantic relevance from reranker
  metadata: VectorMetadata;
}

async function rerankResults(
  query: string,
  matches: VectorizeMatch[],
  env: Env
): Promise<RerankResult[]> {
  if (matches.length === 0) return [];
  
  // Check cache first
  const cacheKey = `rerank:${hashQuery(query, matches.map(m => m.id))}`;
  const cached = await env.RERANK_CACHE.get(cacheKey, 'json');
  if (cached) return cached as RerankResult[];

  // Extract content snippets from metadata (no R2 fetch needed!)
  const contexts = matches.map(m => ({
    text: m.metadata?.content as string || m.metadata?.description as string || ''
  }));

  // Batch rerank - single API call for all documents
  const result = await env.AI.run('@cf/baai/bge-reranker-base', {
    query,
    contexts,
    top_k: 5
  });

  // Map scores back to original matches
  const ranked: RerankResult[] = result.response.map(r => ({
    id: matches[r.id].id,
    score: matches[r.id].score,
    rerankScore: r.score,
    metadata: matches[r.id].metadata as VectorMetadata
  }));

  // Cache for 1 hour
  await env.RERANK_CACHE.put(cacheKey, JSON.stringify(ranked), {
    expirationTtl: 3600
  });

  return ranked;
}

function hashQuery(query: string, ids: string[]): string {
  const input = query + ':' + ids.sort().join(',');
  // Simple hash for cache key
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}
```

### 6.4 Full Document Retrieval

```typescript
/**
 * Fetch full documents from R2 using metadata.path.
 * Only called for final top-K results after reranking.
 */
async function getDocuments(
  results: RerankResult[],
  env: Env
): Promise<R2Document[]> {
  // Fetch in parallel using metadata.path
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

/**
 * Get a single document by ID and contentType.
 */
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
export interface SearchResult {
  id: string;
  contentType: ContentType;
  title: string;
  description: string;
  score: number;
  rerankScore?: number;
  document?: R2Document;  // Full document if requested
}

export async function searchKnowledge(
  query: string,
  filters: SearchFilters,
  options: { includeDocuments?: boolean } = {},
  env: Env
): Promise<SearchResult[]> {
  // Stage 1: Vector search with metadata filtering
  const matches = await searchWithFilters(query, filters, env);
  
  if (matches.length === 0) {
    return [];
  }
  
  // Stage 2: Rerank using metadata.content (no R2 fetch)
  const ranked = await rerankResults(query, matches, env);
  
  // Stage 3: Optionally fetch full documents (only for top 5)
  let documents: R2Document[] = [];
  if (options.includeDocuments) {
    documents = await getDocuments(ranked, env);
  }
  
  // Build results
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

The MCP server exposes three types of primitives:

| Primitive | Controlled By | Purpose |
|-----------|---------------|---------|
| **Tools** | AI model | Callable functions the AI autonomously invokes |
| **Resources** | Application | Read-only data clients inject as context |
| **Prompts** | User | Workflow templates users explicitly invoke |

### 7.2 Server Implementation (Stateless Pattern)

Phase 1 uses stateless `createMcpHandler` with `@modelcontextprotocol/sdk`:

```typescript
// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";

export function createKnowledgeServer(env: Env) {
  const server = new McpServer({
    name: "superbenefit-knowledge",
    version: "1.0.0",
  });

  // Register tools
  registerTools(server, env);
  
  // Register resources
  registerResources(server, env);
  
  // Register prompts
  registerPrompts(server, env);

  return server;
}

// Export handler for OAuthProvider integration
export const McpHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const server = createKnowledgeServer(env);
    return createMcpHandler(server, {
      corsOptions: { origins: ["*"] }
    })(request, env, ctx);
  }
};
```

### 7.3 Tools

**Design Principles (per Cloudflare best practices):**
- Optimize tools for user goals, not API surface area
- Detailed descriptions help the model understand usage
- Permission checks inside handlers, not conditional registration

**Permission Wrapper Pattern:**

```typescript
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
```

**Tool Registration:**

```typescript
function registerTools(server: McpServer, env: Env) {
  // Public tools
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
      const results = await searchLexicon(keyword, env);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "list_groups",
    "List all groups/cells in the SuperBenefit ecosystem.",
    {},
    async () => {
      const groups = await listGroups(env);
      return { content: [{ type: "text", text: JSON.stringify(groups, null, 2) }] };
    }
  );

  server.tool(
    "list_releases",
    "List creative releases with their metadata.",
    {},
    async () => {
      const releases = await listReleases(env);
      return { content: [{ type: "text", text: JSON.stringify(releases, null, 2) }] };
    }
  );

  // Member tools (tier-gated)
  server.tool(
    "get_document",
    "Get the full content of a document by its contentType and ID. " +
    "Requires member access.",
    {
      contentType: ContentTypeSchema.describe("Content type of the document"),
      id: z.string().describe("Document ID"),
    },
    requireTier('member', async ({ contentType, id }, context) => {
      const doc = await getDocument(contentType, id, env);
      if (!doc) {
        return { content: [{ type: "text", text: "Document not found" }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(doc, null, 2) }] };
    })
  );

  server.tool(
    "search_with_documents",
    "Search and return full document content for results. " +
    "Requires member access.",
    {
      query: z.string().describe("Search query"),
      filters: SearchFiltersSchema.optional(),
    },
    requireTier('member', async ({ query, filters }, context) => {
      const results = await searchKnowledge(query, filters || {}, { includeDocuments: true }, env);
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    })
  );

  server.tool(
    "save_link",
    "Save a new link to the library. Requires member access.",
    {
      url: z.string().url().describe("URL to save"),
      title: z.string().describe("Link title"),
      description: z.string().optional().describe("Brief description"),
    },
    requireTier('member', async (params, context) => {
      await saveLink(params, context.props.address, env);
      return { content: [{ type: "text", text: "Link saved successfully" }] };
    })
  );

  // Vibecoder tools
  server.tool(
    "create_draft",
    "Create a new draft document in the knowledge base. " +
    "Requires vibecoder (contributor) access.",
    {
      contentType: ContentTypeSchema.describe("Type of content to create"),
      title: z.string().describe("Document title"),
      content: z.string().describe("Markdown content"),
    },
    requireTier('vibecoder', async (params, context) => {
      const draft = await createDraft(params, context.props.address, env);
      return { content: [{ type: "text", text: JSON.stringify(draft, null, 2) }] };
    })
  );
}
```

### 7.4 Resources

Resources provide read-only context data that clients can inject into conversations.

```typescript
function registerResources(server: McpServer, env: Env) {
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

  // Releases list
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

### 7.5 Prompts

Prompts are workflow templates that users explicitly invoke.

```typescript
function registerPrompts(server: McpServer, env: Env) {
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

### 7.6 OAuthProvider Integration

```typescript
// src/index.ts
import { OAuthProvider } from "workers-oauth-provider";
import { McpHandler } from "./mcp/server";
import { SIWEHandler } from "./auth/oauth";

export default new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: McpHandler,
  defaultHandler: SIWEHandler,
  refreshTokenTTL: 2592000, // 30 days
  
  tokenExchangeCallback: async ({ props, grantType }) => {
    if (grantType === "refresh_token") {
      // Refresh roles on token renewal
      const roles = await checkHatsRoles(props.address, optimismClient);
      const newTier = roles.isContributor ? "vibecoder"
                    : roles.isMember ? "member" : "public";
      return {
        accessTokenProps: { ...props, roles, tier: newTier },
        newProps: { ...props, roles, tier: newTier }
      };
    }
    return {};
  }
});
```

### 7.7 Tool Inventory Summary

| Tool | Description | Tier |
|------|-------------|------|
| `search_knowledge` | Semantic search across knowledge base | Public |
| `define_term` | Get lexicon definition | Public |
| `search_lexicon` | Search lexicon entries | Public |
| `list_groups` | List groups/cells | Public |
| `list_releases` | List creative releases | Public |
| `get_document` | Get full document by ID | Member |
| `search_with_documents` | Search with full documents | Member |
| `save_link` | Save link to library | Member |
| `create_draft` | Create draft document | Vibecoder |

### 7.8 Client Compatibility

| Client | Transport | Auth | Resources | Prompts |
|--------|-----------|------|-----------|---------|
| Claude Desktop | SSE (via mcp-remote) | OAuth | ✅ | ✅ |
| Claude Code | Streamable HTTP | OAuth | ✅ | ✅ |
| Cursor | Streamable HTTP | OAuth | ⚠️ Limited | ⚠️ Limited |
| Windsurf | Streamable HTTP | OAuth | ⚠️ Limited | ⚠️ Limited |
| VS Code | Streamable HTTP | OAuth | ✅ | ✅ |
| MCP Inspector | Streamable HTTP | OAuth | ✅ | ✅ |
| Workers AI Playground | Streamable HTTP | OAuth | ⚠️ Unknown | ⚠️ Unknown |

---

## 8. Public REST API

### 8.1 OpenAPI Configuration

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const api = new OpenAPIHono<{ Bindings: Env }>();

// CORS for all routes
api.use('*', cors({
  origin: '*',
  methods: ['GET', 'HEAD', 'OPTIONS'],
  maxAge: 86400
}));

// Cache headers
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

### 9.1 Phase 2: Stateful Services

**Architecture:** `AIChatAgent` (Durable Object) + AI SDK `tool()` function

```typescript
import { AIChatAgent } from "agents/ai-chat-agent";
import { streamText, tool } from "ai";
import { z } from "zod";

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
      // Human-in-the-loop approval
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

**Capabilities:**
- Resumable streaming (built-in)
- Persistent conversation history
- Human-in-the-loop via `needsApproval`
- Multi-step tool chains

### 9.2 Phase 3: Knowledge Commons (Federation)

**Architecture:** `Agent` as MCP Client connecting to partner DAOs

```typescript
import { Agent } from "agents";
import { streamText } from "ai";

export class CommonsAgent extends Agent<Env> {
  
  partnerServers = [
    { name: "SuperBenefit", url: "https://mcp.superbenefit.xyz/mcp" },
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
    // Get ALL tools from ALL connected MCP servers
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

**Capabilities:**
- `addMcpServer()` connects to any MCP server
- `this.mcp.getAITools()` returns unified tool set
- Automatic OAuth handling
- Tool namespacing prevents conflicts

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
| KV Namespace | `OAUTH_KV` | OAuth tokens |
| KV Namespace | `NONCE_KV` | SIWE nonces |
| KV Namespace | `ROLE_CACHE` | Hats roles |
| KV Namespace | `ENS_CACHE` | ENS resolution |
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

### 11.3 Environment Variables

```
# Required secrets (set via wrangler secret put)
GITHUB_CLIENT_ID=<oauth_client_id>
GITHUB_CLIENT_SECRET=<oauth_client_secret>
GITHUB_TOKEN=<fine_grained_pat>
GITHUB_WEBHOOK_SECRET=<webhook_secret>
COOKIE_ENCRYPTION_KEY=<32_byte_hex>
MAINNET_RPC_URL=<ethereum_mainnet_rpc>
OPTIMISM_RPC_URL=<optimism_rpc>
```

---

## Appendix A: Worker Configuration

```jsonc
// wrangler.jsonc
{
  "name": "superbenefit-knowledge",
  "main": "src/index.ts",
  "compatibility_date": "2024-12-01",
  
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
    { "binding": "OAUTH_KV", "id": "<kv_id>" },
    { "binding": "NONCE_KV", "id": "<kv_id>" },
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
  
  // KV
  OAUTH_KV: KVNamespace;
  NONCE_KV: KVNamespace;
  ROLE_CACHE: KVNamespace;
  ENS_CACHE: KVNamespace;
  RERANK_CACHE: KVNamespace;
  SYNC_STATE: KVNamespace;
  
  // Secrets
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET: string;
  COOKIE_ENCRYPTION_KEY: string;
  MAINNET_RPC_URL: string;
  OPTIMISM_RPC_URL: string;
  
  // Config
  GITHUB_REPO: string;
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

## Appendix E: Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.11 | 2026-02-01 | MCP primitives: stateless createMcpHandler pattern, Resources section, Prompts section, permission wrapper pattern, client compatibility matrix, Phase 2/3 architecture, updated dependencies |
| 0.10 | 2026-02-01 | ID-based retrieval pattern: documented Vector→R2 mapping, metadata structure for reranking, content truncation strategy, retrieval flow stages |
| 0.9 | 2026-02-01 | Ontology alignment: file type hierarchy, updated schemas, Vectorize indexes, prerequisites section |
| 0.8 | 2026-01-30 | Initial MCP + REST API architecture, authentication, sync layer |