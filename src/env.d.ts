// Extend the generated Env interface with secrets and deferred bindings.
// Secrets are set via `wrangler secret put` and aren't in wrangler.jsonc.

// Augment the Cloudflare namespace (used by cloudflare:workers import)
declare namespace Cloudflare {
  interface Env {
    // Secrets
    GITHUB_TOKEN: string;
    GITHUB_WEBHOOK_SECRET: string;
    GITHUB_REPO: string;
    AI_SEARCH_API_TOKEN: string;
    CF_ACCOUNT_ID: string;

    // KV Namespaces
    SYNC_STATE: KVNamespace;

    // R2 Bucket
    KNOWLEDGE: R2Bucket;

    // AI
    AI: Ai;

    // Workflow
    SYNC_WORKFLOW: Workflow;

    // Rate limiting
    RATE_LIMITER: RateLimit;
  }
}

// Also extend the global Env interface (used by Hono bindings)
interface Env {
  // Secrets
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_REPO: string;
  AI_SEARCH_API_TOKEN: string;
  CF_ACCOUNT_ID: string;

  // KV Namespaces
  SYNC_STATE: KVNamespace;

  // R2 Bucket
  KNOWLEDGE: R2Bucket;

  // AI
  AI: Ai;

  // Workflow
  SYNC_WORKFLOW: Workflow;

  // Rate limiting
  RATE_LIMITER: RateLimit;
}
