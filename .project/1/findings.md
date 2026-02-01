# Findings

**Issue**: #1
**Updated**: 2026-01-31

## Research

- Project uses Zod v4 (z4.3.6 in package.json)
- @hono/zod-openapi v1.2.0 for shared API schemas
- Cloudflare bindings typed in worker-configuration.d.ts (auto-generated via cf-typegen)
- Spec defines content model, auth tiers, storage shapes in tmp/spec.md

## Technical Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| Zod v4 for all schemas | Already in package.json, shared with OpenAPI | 2026-01-31 |
| src/types/ directory | Matches planned project structure from CLAUDE.md | 2026-01-31 |

## Key Insights

- Schemas must be compatible with @hono/zod-openapi for REST API route definitions
- Same Zod schemas will be used for both MCP tool inputs and REST API validation
