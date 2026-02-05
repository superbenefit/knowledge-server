# Package 4: Sync Workflow (GitHub → R2)

**Issue:** #5
**Branch:** `claude/sync-github-to-r2-QJyi4`
**Spec Reference:** spec.md v0.11 — Section 5 (Sync Layer)
**Plan Reference:** plan.md v2.6 — Package 4 section

## Scope

Implement the GitHub → R2 sync pipeline:

1. **src/types/sync.ts** — SyncParams type for workflow event payload
2. **src/sync/parser.ts** — Markdown frontmatter parsing with `yaml` package, content type inference
3. **src/sync/github.ts** — GitHub webhook signature verification, file content fetching
4. **src/sync/workflow.ts** — `KnowledgeSyncWorkflow` class extending `WorkflowEntrypoint`

## Key Design Decisions

- **Workflow pattern:** Cloudflare Workflows API (`WorkflowEntrypoint`) for durable execution with automatic retries
- **Publish gate:** Only sync content with `publish: true` AND `draft: false` (or draft absent)
- **NonRetryableError:** Used for 404s (file not found) — no point retrying
- **Retryable errors:** Rate limits (429), server errors (5xx) — exponential backoff
- **R2Document:** Stored as JSON at `content/{contentType}/{id}.json`
- **ID generation:** From filename stem (e.g., `cell-governance.md` → `cell-governance`)

## Files

| File | Purpose |
|------|---------|
| `src/types/sync.ts` | SyncParams, webhook payload types |
| `src/sync/parser.ts` | `parseMarkdown()` — YAML frontmatter + body extraction |
| `src/sync/github.ts` | `verifyWebhookSignature()`, `fetchFileContent()`, `isExcluded()` |
| `src/sync/workflow.ts` | `KnowledgeSyncWorkflow` — main workflow class |

## Dependencies

- Package 0 (Schemas): `inferContentType`, `generateId`, `toR2Key`, `R2Document`
- `yaml` package: frontmatter parsing
- Cloudflare Workers types: `WorkflowEntrypoint`, `WorkflowStep`, `WorkflowEvent`
