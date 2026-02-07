# Knowledge Server Upgrade: v0.13 → v0.16

## Task

Upgrade the knowledge server codebase to align with specification v0.16. The codebase is currently at v0.13. Three spec revisions have occurred (v0.14, v0.15, v0.16) — apply all changes in a single pass.

## Reference Documents

Read these **before writing any code**. They define exactly what changes are needed and why.

| Document | What it tells you |
|----------|-------------------|
| `docs/spec.md` | Target state (v0.16). Authoritative for all type definitions, schemas, server structure, and fetch handler patterns. |
| `docs/13-14-changelog.md` | Porch alignment changes: auth restructure, McpHandler elimination, per-request McpServer factory, CVE constraint. |
| `docs/14-15-changelog.md` | Ontology alignment: PATH_TYPE_MAP rewrite, question type promotion, QuestionSchema base change. |
| `docs/15-16-changelog.md` | Schema reconciliation: GroupSchema, ProjectSchema, PlaceSchema, GatheringSchema field alignment; HatsRole abstraction; terminology cleanup. |
| `docs/ontology.md` | Source of truth for content type definitions and field names. When in doubt about a schema field, this wins. |
| `docs/mcporch-spec.md` | Porch framework spec (v0.19). Reference for shared types and conventions — but don't implement porch internals, just consume the types. |

Read the changelogs in order (13→14, 14→15, 15→16) to understand the progression. Then use `spec.md` v0.16 as the target state for your implementation.

## Scope

### Code Changes Required

**Auth structure** (from v0.13→v0.14):
- Move `src/types/auth.ts` → `src/auth/types.ts`
- Create `src/auth/resolve.ts` — standard `resolveAuthContext()` (always returns open tier in Phase 1)
- Create `src/auth/check.ts` — standard `checkTierAccess()`
- `AuthContext` type must include `address` and `roles` fields (both `null` in Phase 1)
- `roles` field type is `PorchRoles | null` — do NOT reproduce the `HatsRole` interface. Import or type-alias from porch.
- Delete `src/types/` directory if empty after move

**Server structure** (from v0.13→v0.14):
- Create `src/mcp/server.ts` with `createMcpServer(env)` factory
- `McpServer` must be instantiated per-request (CVE GHSA-qgp8-v765-qxx9)
- Eliminate any `McpHandler` wrapper class — inline `createMcpHandler` in the fetch handler
- Update fetch handler for standard porch route split pattern (see spec §7.4)

**Content model** (from v0.14→v0.16):
- Update `PATH_TYPE_MAP` to match spec §3.5 (two-space model with `docs/` and `data/` paths)
- Remove `question` from `RESOURCE_TYPES` array
- `QuestionSchema` extends `FileSchema` (not `ResourceSchema`)
- Update `GroupSchema`: remove `aliases`, `logo`; add `slug`, `parent`
- Update `ProjectSchema`: add `slug`, `contributors`, `group`, `repository`, `startDate`, `endDate`
- Update `PlaceSchema`: replace `coordinates` object with `geo` string; add `containedIn`
- Update `GatheringSchema`: replace `eventDate` with `startDate`/`endDate`; remove `homepage`; add `organizers`, `outcomes`

**Dependencies** (from v0.13→v0.16):
- Ensure `@modelcontextprotocol/sdk` is `>=1.26.0`
- Ensure `zod` is `^4.3.6`
- Remove any lingering references to `@hatsprotocol/sdk-v1-core`, `viem`, `workers-oauth-provider`, `octokit`, `just-pick` (these were removed in v0.13 but verify they're gone)

**Config** (from v0.13→v0.14):
- Remove `OAUTH_KV`, `NONCE_KV`, `COOKIE_ENCRYPTION_KEY` bindings from `wrangler.jsonc` if present
- Remove any OAuth-related environment variables from `env.d.ts`

### NOT in Scope

These items are spec documentation changes only — no code impact:
- §1.1 terminology ("MCPorch ecosystem" → neutral phrasing) — spec wording only
- §2.6 WaaP section — spec wording only
- §4.5 KV namespace note — spec wording only
- §7.7 prompt template "artifacts" reference — spec wording only
- §9.2 Phase 3 description — spec wording only

## Approach

1. **Read all reference docs first.** Understand the full v0.13→v0.16 delta before touching code.
2. **Auth restructure first.** Get `src/auth/` in place since the fetch handler and tools depend on it.
3. **Server factory next.** Create `createMcpServer(env)` and update the fetch handler.
4. **Content model last.** Update schemas, PATH_TYPE_MAP, and type groupings.
5. **Verify.** TypeScript compilation must pass. Run any existing tests.

## Validation

After all changes:
- [ ] `npx tsc --noEmit` passes
- [ ] `src/auth/types.ts` exports `AccessTier`, `Identity`, `AuthContext`, `TIER_LEVEL`
- [ ] `src/auth/resolve.ts` exports `resolveAuthContext()` returning `{ identity: null, tier: 'open', address: null, roles: null }`
- [ ] `src/auth/check.ts` exports `checkTierAccess()`
- [ ] `src/mcp/server.ts` exports `createMcpServer(env)` factory
- [ ] Fetch handler creates McpServer per-request (no shared instance)
- [ ] No `McpHandler` wrapper class exists
- [ ] `PATH_TYPE_MAP` matches spec §3.5 exactly
- [ ] `RESOURCE_TYPES` does not include `'question'`
- [ ] `QuestionSchema` extends `FileSchema`
- [ ] `GroupSchema` has `slug`, `parent`; does not have `aliases`, `logo`
- [ ] `ProjectSchema` has `slug`, `contributors`, `group`, `repository`, `startDate`, `endDate`
- [ ] `PlaceSchema` has `geo` (string), `containedIn`; does not have `coordinates` (object)
- [ ] `GatheringSchema` has `startDate`, `endDate`, `organizers`, `outcomes`; does not have `eventDate`, `homepage`
- [ ] No references to `HatsRole` interface (use `PorchRoles` or equivalent opaque type)
- [ ] No imports of `@hatsprotocol/sdk-v1-core` or `viem`
- [ ] `@modelcontextprotocol/sdk` version is `>=1.26.0`
- [ ] `wrangler.jsonc` has no `OAUTH_KV`, `NONCE_KV`, or `COOKIE_ENCRYPTION_KEY` bindings