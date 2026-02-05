# Plan: Phase 0.5 — GitHub OAuth + Initial Deploy

**Phase**: complete
**Started**: 2026-02-04

## Goal

Set up GitHub OAuth App, configure Cloudflare Worker deployment with custom domain, and establish production secrets for the knowledge-server.

## Approach

HITL (Human In The Loop) task. Claude automated config changes and key generation; user handled GitHub OAuth App creation, Cloudflare dashboard deployment, custom domain setup, and secret configuration.

## Implementation Steps

- [x] Comment out unused bindings in wrangler.jsonc (KV, R2, Vectorize, Queues, Workflows)
- [x] Add SuperBenefit account_id to wrangler.jsonc
- [x] User creates GitHub OAuth App (knowledge-server)
- [x] Generate COOKIE_ENCRYPTION_KEY
- [x] Create .dev.vars with all 3 secrets
- [x] Verify .dev.vars is gitignored
- [x] Verify local dev (npm run dev on port 8788)
- [x] Deploy worker to Cloudflare (dashboard via git integration)
- [x] User configures custom domain (knowledge-server.superbenefit.dev)
- [x] User sets production secrets in Cloudflare dashboard
- [x] Verify production endpoint responds

## Blockers

None.
