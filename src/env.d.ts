// Extend the generated Env interface with secrets and deferred bindings.
// Secrets are set via `wrangler secret put` and aren't in wrangler.jsonc.
// Deferred bindings are commented in wrangler.jsonc until resources are created.

// Augment the Cloudflare namespace (used by cloudflare:workers import)
declare namespace Cloudflare {
  interface Env {
    // Secrets (active)
    GITHUB_TOKEN: string;
    GITHUB_WEBHOOK_SECRET: string;
    GITHUB_REPO: string;

    // Secrets (dormant — Phase 3)
    MAINNET_RPC_URL: string;
    OPTIMISM_RPC_URL: string;

    // KV Namespaces (active)
    RERANK_CACHE: KVNamespace;
    SYNC_STATE: KVNamespace;

    // KV Namespaces (dormant — Phase 3)
    ROLE_CACHE: KVNamespace;
    ENS_CACHE: KVNamespace;

    // R2 Bucket
    KNOWLEDGE: R2Bucket;

    // Vectorize Index
    VECTORIZE: VectorizeIndex;

    // AI
    AI: Ai;

    // Workflow
    SYNC_WORKFLOW: Workflow;

    // Phase 2 (optional, unused until then)
    CF_ACCESS_AUD?: string;
  }
}

// Also extend the global Env interface (used by Hono bindings)
interface Env {
  // Secrets (active)
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_REPO: string;

  // Secrets (dormant — Phase 3)
  MAINNET_RPC_URL: string;
  OPTIMISM_RPC_URL: string;

  // KV Namespaces (active)
  RERANK_CACHE: KVNamespace;
  SYNC_STATE: KVNamespace;

  // KV Namespaces (dormant — Phase 3)
  ROLE_CACHE: KVNamespace;
  ENS_CACHE: KVNamespace;

  // R2 Bucket
  KNOWLEDGE: R2Bucket;

  // Vectorize Index
  VECTORIZE: VectorizeIndex;

  // AI
  AI: Ai;

  // Workflow
  SYNC_WORKFLOW: Workflow;

  // Phase 2 (optional, unused until then)
  CF_ACCESS_AUD?: string;
}
