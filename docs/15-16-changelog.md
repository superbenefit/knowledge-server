# Knowledge Server Spec Changelog: v0.15 → v0.16

**Date:** February 7, 2026  
**Aligned with:** Porch spec v0.19, ontology.md (Feb 7, 2026)

---

## Summary

This update reconciles schema drift between the ontology and knowledge server spec, abstracts Hats Protocol implementation details out of the knowledge server spec (they belong in the porch spec), and replaces "MCPorch ecosystem" marketing language with neutral phrasing. Also fixes a rendering glitch and a stale term in the prompt template.

The mcporch spec is bumped to v0.19 to stay aligned (stale knowledge server section updated, Zod version aligned to 4.x).

---

## 1. Header — Porch Alignment Bumped

**v0.15:**
```
Porch Spec Alignment: v0.18
```

**v0.16:**
```
Porch Spec Alignment: v0.19
```

Tracks the porch spec version bump triggered by this same audit.

## 2. §1.1 Purpose — "MCPorch Ecosystem" Replaced

**v0.15:** "the first MCP server in the MCPorch ecosystem"

**v0.16:** "the first MCP server built on the porch framework"

**v0.15:** "across all MCP servers in the ecosystem"

**v0.16:** "across all SB MCP servers"

MCPorch is a coordination layer, not an ecosystem. "Ecosystem" framing is reserved for the broader SuperBenefit network.

## 3. §1.7 Phased Architecture — Neutral Phrasing, Hats Abstracted

**v0.15 intro:** "Porch access tiers are ecosystem-wide — when a phase ships, every registered MCP server gains that tier's capabilities."

**v0.16 intro:** "Porch access tiers apply to all registered MCP servers — when a phase ships, every server gains that tier's capabilities."

**v0.15 Phase 3 row:**
```
| **3. Knowledge Commons** | ... | + Members (Hats/token gate) |
```

**v0.16 Phase 3 row:**
```
| **3. Knowledge Commons** | ... | + Members (porch Phase 3) |
```

The knowledge server spec should not name the specific authorization mechanism — that's a porch design decision.

## 4. §2.1 Tier Model — Members Authorization Abstracted

**v0.15:** `| **Members** | Excludable, rivalrous | Required | Hats/token/org check |`

**v0.16:** `| **Members** | Excludable, rivalrous | Required | Role/token check |`

Same rationale: the check mechanism is a porch implementation detail.

## 5. §2.2 Porch Types — HatsRole Abstracted

**v0.15:**
```typescript
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

**v0.16:**
```typescript
export interface AuthContext {
  identity: Identity | null;
  tier: AccessTier;
  address: `0x${string}` | null;
  roles: PorchRoles | null;  // see porch spec for PorchRoles definition
}
```

The `HatsRole` interface definition is removed. The knowledge server references `PorchRoles` as an opaque type owned by the porch spec. This prevents the knowledge server spec from drifting if the porch switches authorization providers (e.g. from Hats Protocol to another system).

**Phase note also updated:**

**v0.15:** "Phase 3 populates `address` and `roles` from Hats Protocol / identity mapping."

**v0.16:** "Phase 3 populates `address` and `roles` via the porch authorization module (see porch spec §Phase 3 Design)."

## 6. §2.6 WaaP Section — Condensed to Porch Reference

**v0.15:** Full section titled "WaaP Integration (UI Client)" with auth method table (Wallet/Email/Social), WaaP SDK details, frontend domain names (`front.porch.superbenefit.dev/ai`, `back.porch.superbenefit.dev/ai`), and SIWE OIDC flow description (11 lines).

**v0.16:** Retitled "Frontend Identity (WaaP)". Condensed to 1 line: "WaaP is a frontend wallet SDK that runs in the browser. It handles wallet creation, SIWE message signing, and social login flows. The knowledge server does not depend on WaaP directly — it receives standard Access JWTs. See the porch spec §Phase 2 Design for the full identity provider architecture."

WaaP details belong in the porch spec (it's a porch Phase 2 dependency). The knowledge server only needs to know it receives Access JWTs.

## 7. §3.5/3.6 Boundary — Stray Backtick Removed

A stray triple-backtick between the §3.5 Note block and §3.6 heading caused a rendering glitch that ate the "Schemas" heading in some renderers.

## 8. §3.6 Schemas — Ontology Reconciliation (Critical)

Four data type schemas updated to match the ontology's field definitions:

### GroupSchema

**v0.15:**
```typescript
export const GroupSchema = DataSchema.extend({
  aliases: z.array(z.string()).optional(),
  members: z.array(z.string()).optional(),
  homepage: z.string().url().optional(),
  logo: z.string().optional(),
});
```

**v0.16:**
```typescript
export const GroupSchema = DataSchema.extend({
  slug: z.string().optional(),
  members: z.array(z.string()).optional(),
  parent: z.string().optional(),
  homepage: z.string().url().optional(),
});
```

| Change | Rationale |
|--------|-----------|
| `aliases` removed | Not in ontology `group` type |
| `logo` removed | Not in ontology `group` type |
| `slug` added | Ontology defines `slug` as official identifier |
| `parent` added | Ontology defines `parent` for parent organization |

### ProjectSchema

**v0.15:**
```typescript
export const ProjectSchema = DataSchema.extend({
  status: z.enum(['active', 'completed', 'paused', 'archived']).optional(),
  lead: z.array(z.string()).optional(),
  homepage: z.string().url().optional(),
});
```

**v0.16:**
```typescript
export const ProjectSchema = DataSchema.extend({
  slug: z.string().optional(),
  status: z.enum(['active', 'completed', 'paused', 'archived']).optional(),
  lead: z.array(z.string()).optional(),
  contributors: z.array(z.string()).optional(),
  group: z.string().optional(),
  repository: z.string().optional(),
  homepage: z.string().url().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});
```

| Change | Rationale |
|--------|-----------|
| `slug` added | Ontology defines `slug` (official identifier) |
| `contributors` added | Ontology defines `contributors` (doap:developer) |
| `group` added | Ontology defines `group` (owning cell/org) |
| `repository` added | Ontology defines `repository` (doap:repository) |
| `startDate` added | Ontology defines `startDate` (schema:startDate) |
| `endDate` added | Ontology defines `endDate` (schema:endDate) |

### PlaceSchema

**v0.15:**
```typescript
export const PlaceSchema = DataSchema.extend({
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  region: z.string().optional(),
});
```

**v0.16:**
```typescript
export const PlaceSchema = DataSchema.extend({
  geo: z.string().optional(),
  containedIn: z.string().optional(),
  region: z.string().optional(),
});
```

| Change | Rationale |
|--------|-----------|
| `coordinates` → `geo` | Ontology uses `geo` (string, schema:geo) not a structured object. Accepts "lat/long or GeoShape" as string. |
| `containedIn` added | Ontology defines `containedIn` (schema:containedInPlace) |

### GatheringSchema

**v0.15:**
```typescript
export const GatheringSchema = DataSchema.extend({
  eventDate: z.coerce.date().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  homepage: z.string().url().optional(),
});
```

**v0.16:**
```typescript
export const GatheringSchema = DataSchema.extend({
  location: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  organizers: z.array(z.string()).optional(),
  attendees: z.array(z.string()).optional(),
  outcomes: z.array(z.string()).optional(),
});
```

| Change | Rationale |
|--------|-----------|
| `eventDate` → `startDate`/`endDate` | Ontology uses schema:startDate/endDate (events can span multiple days) |
| `homepage` removed | Not in ontology `gathering` type |
| `organizers` added | Ontology defines `organizers` (schema:organizer) |
| `outcomes` added | Ontology defines `outcomes` (links to resulting artifacts) |

## 9. §4.5 KV Namespaces — Phase 3 Note Simplified

**v0.15:** "Phase 3 adds ecosystem-wide KV namespaces (`ROLE_CACHE`, `ENS_CACHE`, `IDENTITY_MAP`, `SYBIL_CACHE`, `AGREEMENTS`) managed by the porch framework."

**v0.16:** "Phase 3 adds porch-managed KV namespaces for role caching, identity mapping, and agreement tracking."

The knowledge server spec should not enumerate porch-internal namespace names. If porch renames or restructures its KV layout, the knowledge server spec shouldn't need updating.

## 10. §7.7 Prompt Template — "artifacts" → "knowledge base"

**v0.15:** "Related patterns and practices from artifacts"

**v0.16:** "Related patterns and practices from the knowledge base"

The `artifacts/` directory was eliminated in v0.15. This reference was missed.

## 11. §9.2 Phase 3 — Hats Protocol Reference Removed

**v0.15:** "Access: Members tier via Hats Protocol / token gating (porch Phase 3)"

**v0.16:** "Access: Members tier (porch Phase 3)"

Same pattern as §2.1 and §1.7: the authorization mechanism is a porch implementation detail.

## 12. Appendix D — Hats SDK Dependency Note Removed

**v0.15:**
```
> `@modelcontextprotocol/sdk` must be ≥1.26.0 for per-request safety (CVE GHSA-qgp8-v765-qxx9).
> Phase 3 will add `@hatsprotocol/sdk-v1-core` and `viem` for Hats Protocol and SIWE verification.
```

**v0.16:**
```
> `@modelcontextprotocol/sdk` must be ≥1.26.0 for per-request safety (CVE GHSA-qgp8-v765-qxx9).
```

Phase 3 dependencies are a porch concern. The knowledge server will import them transitively via `@superbenefit/mcporch`.

## 13. Appendix E — Version History Entry Added

Added v0.16 entry documenting all changes.

---

## MCPorch Spec Changes (v0.18 → v0.19)

These changes were made to the porch spec to stay aligned:

### Knowledge Server Section — Stale References Removed

| Item | v0.18 | v0.19 | Rationale |
|------|-------|-------|-----------|
| Server structure: `auth/hats.ts` | Listed | Removed | Deleted in knowledge server v0.13 |
| Server structure: `auth/ens.ts` | Listed | Removed | Deleted in knowledge server v0.13 |
| What Stays: `src/auth/hats.ts` | "Kept — authorization logic for Phase 3" | Removed | File doesn't exist |
| What Stays: `src/auth/ens.ts` | "Kept — ENS resolution for display" | Removed | File doesn't exist |
| What Stays: `ROLE_CACHE` KV | "Kept — needed for Phase 3" | Removed | Binding doesn't exist |
| What Stays: `ENS_CACHE` KV | "Kept — needed for Phase 3" | Removed | Binding doesn't exist |
| Acceptance criteria | "hats.ts and ens.ts remain functional" | Removed | Files don't exist |
| Section intro | "first MCP server in the ecosystem" | "first MCP server built on the porch framework" | Terminology alignment |

### Zod Version — 3.x → 4.x

**v0.18:** `| zod | 3.x | MCP tool parameter schemas |`

**v0.19:** `| zod | 4.x | MCP tool parameter schemas |`

Knowledge server spec already uses `"zod": "^4.3.6"`. Porch conventions should match what servers actually use.

---

## Migration Plan — Restructured for HITL Execution

| Change | Detail |
|--------|--------|
| Execution model header | Added `Execution model: Agent-assisted with human-in-the-loop gates` |
| Execution Order | Flat 18-step checklist replaced with 7 gates (Gate 0–6), each with explicit **STOP** points and human review criteria |
| 🧑 steps | Steps requiring human judgment marked with 🧑 emoji: release group sorting (Gate 2), dual-type resolution (Gates 2, 4), archive tracking decision (Gate 5), final merge (Gate 6) |
| Gate summary table | Added at end of Execution Order for quick reference |
| Dry-run gate | Phase 3 frontmatter scripts now require dry-run → human review → apply sequence (Gate 4) |
| Phase intros | Phases 1–3 updated to reference their corresponding gates |
| Risk mitigation | Updated to reference gate structure; added "agent executing manual-judgment steps" and "no rollback point" risks |
| Version references | v0.15 → v0.16 |

No structural changes to Phase 1–6 step definitions themselves — the content is the same, just the execution sequencing now has explicit pause points.

---

## Changes NOT Made

These items were considered but intentionally left unchanged:

1. **Storage architecture (§4)** — No changes. Schema field additions don't affect R2 key structure.
2. **Vectorize metadata indexes (§4.3)** — No changes. New fields (`slug`, `parent`, `contributors`, `startDate`, etc.) are not indexed — they're document-level metadata, not filter dimensions.
3. **Sync layer (§5)** — No changes.
4. **Retrieval system (§6)** — No changes.
5. **MCP tools (§7.5)** — No changes to tool definitions or schemas.
6. **REST API (§8)** — No changes.
7. **Error handling (§10)** — No changes.
8. **Infrastructure (§11)** — No changes.
9. **Zod version in spec Appendix D** — Left as `"zod": "^4.3.6"`. Porch spec updated to match.
10. **Ontology** — No changes needed. The ontology is the source of truth; the spec was updated to match it.
11. **Content Discriminated Union (§3.7)** — No changes. All type literals remain the same.
12. **Worker configuration (Appendix A)** — No changes.

---

## Impact Summary

| Scope | Impact |
|-------|--------|
| Schema validation | New required fields for group, project, place, gathering types. Existing content may need frontmatter updates during migration. |
| R2 stored data | Unaffected — R2 documents store parsed frontmatter as-is. New fields are all optional. |
| Vectorize index | Unaffected — new fields are not indexed metadata. |
| Sync workflow | Unaffected — schemas are used for validation, and all new fields are optional. |
| Type imports | `HatsRole` no longer exported from knowledge server types. Consumers should import `PorchRoles` from `@superbenefit/mcporch` instead. |