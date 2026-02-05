# Package 4: Sync Workflow — Progress

**Issue:** #5
**Branch:** `claude/sync-github-to-r2-QJyi4`

## Completed

- [x] Created `src/types/sync.ts` — SyncParams, R2EventNotification, GitHubPushEvent, ParsedMarkdown types
- [x] Installed `yaml` package for frontmatter parsing
- [x] Created `src/sync/parser.ts` — parseMarkdown(), validateFrontmatter(), shouldSync(), resolveContentType()
- [x] Created `src/sync/github.ts` — verifyWebhookSignature(), fetchFileContent(), isExcluded()
- [x] Created `src/sync/workflow.ts` — KnowledgeSyncWorkflow class extending WorkflowEntrypoint
- [x] Updated `src/types/index.ts` to export sync types
- [x] Added KnowledgeSyncWorkflow export to `src/index.ts` (required for Cloudflare binding discovery)
- [x] TypeScript type-check passes (`npx tsc --noEmit`)

## Architecture

```
src/types/sync.ts          SyncParams, R2EventNotification, ParsedMarkdown
src/sync/parser.ts         YAML frontmatter parsing, publish/draft gating
src/sync/github.ts         Webhook HMAC verification, GitHub Contents API
src/sync/workflow.ts       KnowledgeSyncWorkflow (WorkflowEntrypoint)
```

## Key Design Notes

- Workflow uses per-file steps with independent retry (limit: 5, exponential backoff from 30s)
- 404 errors throw NonRetryableError; 429/5xx are retried
- Only `publish: true` AND `draft !== true` content is synced to R2
- Unpublished files that previously existed in R2 are cleaned up
- Content type resolved from frontmatter `type` field first, then path inference
- Webhook signature uses Web Crypto API (HMAC-SHA256) with constant-time comparison

## Remaining (out of scope for this package)

- Webhook HTTP handler (will be wired in Integration phase via Hono route)
- wrangler.jsonc workflow binding (already present as commented template)
- R2 event notifications → Queue consumer (Package 5)
