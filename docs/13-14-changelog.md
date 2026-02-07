# Knowledge Server Spec Changelog: v0.13 → v0.14

**Date:** February 7, 2026  
**Aligned with:** Porch spec v0.18

---

## Summary

This update aligns the knowledge server spec with the porch spec v0.18, which reframed porch from the knowledge server's auth layer into a multi-server MCP coordination framework (MCPorch). The changes are primarily structural and terminological — no functional behavior changes.

---

## 1. Title & Identity

| Section | v0.13 | v0.14 | Rationale |
|---------|-------|-------|-----------|
| Document title | "SuperBenefit AI Tools Infrastructure Specification" | "Knowledge Server Specification" | This spec is for one MCP server, not all of SB's AI tools infrastructure. The porch spec owns the ecosystem-level framing. |

## 2. §1.1 Purpose — Ecosystem Positioning

**v0.13:** "This specification defines the architecture for SuperBenefit's AI tools infrastructure."

**v0.14:** "This specification defines the architecture for SuperBenefit's knowledge server — the first MCP server in the MCPorch ecosystem."

Added explicit reference to `@superbenefit/porch` as the source of shared types, auth resolution, and tier checking. Clarified that this server follows the same conventions any future SB MCP server will follow.

## 3. §1.3 Design Principles

| # | v0.13 | v0.14 | Change |
|---|-------|-------|--------|
| 2 | "Single connection point — Members configure one URL, get all tools" | "Porch conventions — Standard auth/, fetch handler, tool pattern from `@superbenefit/porch`" | The "single URL" concept now lives in the porch spec (MCPorch Portal). This server's principle is about following porch conventions. |
| 3 | "Porch access control — Three-tier framework" | *(removed, merged into #2)* | Redundant with the porch conventions principle |

Principles renumbered from 10 to 9.

## 4. §1.4 Key Architectural Decisions

**"Why the porch framework" bullet 5:**
- v0.13: "New SB servers get auth for free by registering in the same Portal"
- v0.14: "New SB MCP servers get auth for free by registering in the MCPorch Portal"

Uses correct terminology: "MCP servers" (not "SB servers") and "MCPorch Portal" (product name).

## 5. §1.5 Reference Implementations

Major overhaul. The v0.13 table used `npm create cloudflare@latest --template=...` URLs that pointed to the `cloudflare/ai/demos/` directory. The porch spec v0.18 research identified that these have been reorganized into `cloudflare/agents/examples/`.

| v0.13 Entry | v0.14 Entry | Notes |
|-------------|-------------|-------|
| `cloudflare/ai/demos/remote-mcp-server` | `cloudflare/agents/examples/mcp-worker` | New canonical location |
| `cloudflare/ai/demos/remote-mcp-cf-access` | `cloudflare/agents/examples/mcp-worker-authenticated` | Split into two entries for Access for SaaS vs authContext injection |
| `cloudflare/ai/demos/remote-mcp-github-oauth` | `cloudflare/agents/examples/mcp` | Stateful MCP example |
| SIWE (spruceid/siwe-oidc) | *(removed)* | Not needed for Phase 1; porch spec owns SIWE references |
| AIChatAgent docs URL | *(removed)* | Phase 2 concern; porch spec owns |
| MCP Client API docs URL | *(removed)* | Phase 3 concern; porch spec owns |
| MCP Server Portals old URL | Updated to `/cloudflare-one/access-controls/ai-controls/mcp-portals/` | URL structure changed in Cloudflare docs |

## 6. §1.6 System Architecture Diagram

**v0.13:** Application layer labeled `porch.superbenefit.dev`
**v0.14:** Application layer labeled `Knowledge Server (Cloudflare Worker)`

The domain `porch.superbenefit.dev` belongs to MCPorch (the coordination hub), not this individual server. The knowledge server will have its own domain.

## 7. §1.7 Phased Architecture

**v0.13:** Generic column headers "Focus", "Architecture", "Access"
**v0.14:** Column renamed to "Knowledge Server Focus" and "Porch Tier"

Added introductory text: "Porch access tiers are ecosystem-wide — when a phase ships, every registered MCP server gains that tier's capabilities."

This clarifies that phases are not knowledge-server-specific — they're porch-ecosystem-wide events that this server builds on top of.

## 8. §2 Access Control — Section Intro

**v0.13:** "This section defines the access control framework for the knowledge server."
**v0.14:** "Access control is provided by the porch framework. This section documents the knowledge server's use of the porch types and patterns. The porch spec (`@superbenefit/porch` spec.md) is the canonical reference..."

Establishes clear ownership: porch spec is canonical, this section documents _usage_.

## 9. §2.2 AuthContext Type — Full Porch Shape Restored

This is the most significant structural change.

**v0.13 (simplified):**
```typescript
export interface AuthContext {
  identity: Identity | null;
  tier: AccessTier;
}
```

**v0.14 (full porch shape):**
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

**Why:** v0.13 stripped `address`, `roles`, and `HatsRole` during the "dormant code removal" pass, treating them as Phase 3 concerns. But the porch spec v0.18 defines these as part of the standard type that all servers share. Having a different `AuthContext` shape in the knowledge server would cause type mismatches when importing from `@superbenefit/porch`. The fields are `null` in Phase 1 — they don't add code complexity, just type completeness.

**File path also changed:**
- v0.13: `src/types/auth.ts`
- v0.14: `src/auth/types.ts` (standard porch layout)

## 10. §2.3 Auth Context Resolution

**v0.13 return:** `{ identity: null, tier: 'open' }`
**v0.14 return:** `{ identity: null, tier: 'open', address: null, roles: null }`

Matches the full AuthContext shape.

## 11. §2.5 Phase 2 authContext Injection

Minor wording changes:
- v0.13: `validateAccessJWT(request, env.CF_ACCESS_AUD)` → v0.14: `resolveAuthFromHeaders(request, env)` (matches porch naming)
- v0.13: "See §2.5" self-reference → v0.14: "See the porch spec §Phase 2 Design"
- Removed `corsOptions: { origin: '*' }` from Phase 2 snippet (CORS is a Phase 1 concern, not Phase 2-specific)

## 12. §4.5 KV Namespaces — Phase 3 Note

**v0.13:** "Phase 3 will add `ROLE_CACHE` and `ENS_CACHE` KV namespaces for Hats Protocol and ENS resolution caching."

**v0.14:** "Phase 3 adds ecosystem-wide KV namespaces (`ROLE_CACHE`, `ENS_CACHE`, `IDENTITY_MAP`, `SYBIL_CACHE`, `AGREEMENTS`) managed by the porch framework. See porch spec §Phase 2/3 Design for details."

Expanded to include all five KV namespaces defined in porch spec v0.18, and clarified these are ecosystem-wide (managed by porch), not knowledge-server-specific.

## 13. §7.2–7.4 Server Structure (Major Restructure)

**v0.13** had three sections:
- §7.2 "Server Implementation" — `createKnowledgeServer()` factory + `McpHandler` wrapper object
- §7.3 "Router Integration" — fetch handler importing `McpHandler`

**v0.14** has three sections:
- §7.2 "Server Structure" — directory layout diagram showing standard porch server layout
- §7.3 "Server Factory" — `createMcpServer()` with CVE documentation
- §7.4 "Fetch Handler" — inline handler (no McpHandler wrapper)

Key changes:

**McpHandler wrapper eliminated.** v0.13 had a `McpHandler` object with its own `fetch()` method that the main fetch handler delegated to. v0.14 inlines the `createMcpHandler` call directly in the fetch handler — matching the porch spec's standard pattern and reducing indirection.

**CVE documented.** v0.14 adds: "Per-request `McpServer` instantiation is a security requirement (MCP SDK ≥1.26.0, CVE GHSA-qgp8-v765-qxx9). Sharing `McpServer` instances across requests leaks response data between clients." This was discovered during porch spec research.

**Directory layout added.** v0.14 includes a `knowledge-server/` tree showing the standard porch server layout with `src/auth/` (not `src/types/`), `src/mcp/server.ts`, `src/mcp/tools/`, and `src/api/`.

**Section numbers shifted.** Former §7.4 Tools → §7.5, §7.5 Resources → §7.6, etc. through §7.8 → §7.9.

## 14. §9.1–9.2 Future Phases

Minor wording:
- v0.13: "Access: Public tier via Cloudflare Access for SaaS (see §2.5)"
- v0.14: "Access: Public tier via Cloudflare Access for SaaS (porch Phase 2)"

- v0.13: "Access: Members tier via Hats Protocol / token gating"
- v0.14: "Access: Members tier via Hats Protocol / token gating (porch Phase 3)"

Clarifies these are porch-ecosystem phases, not knowledge-server-specific.

## 15. Appendix D: Dependencies

**Added:** `"@modelcontextprotocol/sdk": "^1.26.0"` to dependencies list.

This was missing from v0.13 despite being imported in code. The minimum version constraint (≥1.26.0) is tied to the CVE documented in §7.3.

Added footnote: "`@modelcontextprotocol/sdk` must be ≥1.26.0 for per-request safety (CVE GHSA-qgp8-v765-qxx9)."

---

## Changes NOT Made

These items were considered but intentionally left unchanged:

1. **Content model (§3)** — No changes. The ontology is knowledge-server-specific, not porch-ecosystem.
2. **Storage architecture (§4.1–4.4)** — No changes. R2/Vectorize are knowledge-server-specific.
3. **Sync layer (§5)** — No changes. GitHub sync is knowledge-server-specific.
4. **Retrieval system (§6)** — No changes. RAG pipeline is knowledge-server-specific.
5. **Tool implementations (§7.5)** — No functional changes to tool logic or schemas.
6. **REST API (§8)** — No changes.
7. **Error handling (§10)** — No changes.
8. **Infrastructure resources (§11)** — No changes to resource names or setup commands.
9. **Worker configuration (Appendix A)** — No changes.
10. **Environment types (Appendix B)** — No changes (AuthContext lives in src/auth/types.ts, not env.d.ts).