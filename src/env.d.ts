// Extend the generated Env interface with secrets and deferred bindings.
// Secrets are set via `wrangler secret put` and aren't in wrangler.jsonc.
// Deferred bindings are commented in wrangler.jsonc until resources are created.

// Augment the Cloudflare namespace (used by cloudflare:workers import)
declare namespace Cloudflare {
  interface Env {
    // Secrets
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    COOKIE_ENCRYPTION_KEY: string;
    GITHUB_TOKEN: string;
    GITHUB_WEBHOOK_SECRET: string;
    GITHUB_REPO: string;
    MAINNET_RPC_URL: string;
    OPTIMISM_RPC_URL: string;

    // KV Namespaces (deferred until created)
    OAUTH_KV: KVNamespace;
    NONCE_KV: KVNamespace;
    ROLE_CACHE: KVNamespace;
    ENS_CACHE: KVNamespace;
    RERANK_CACHE: KVNamespace;
    SYNC_STATE: KVNamespace;

    // R2 Bucket
    KNOWLEDGE: R2Bucket;

    // Vectorize Index
    VECTORIZE: VectorizeIndex;

    // Workflow
    SYNC_WORKFLOW: Workflow;
  }
}

// Also extend the global Env interface (used by Hono bindings)
interface Env {
  // Secrets
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  COOKIE_ENCRYPTION_KEY: string;
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_REPO: string;
  MAINNET_RPC_URL: string;
  OPTIMISM_RPC_URL: string;

  // KV Namespaces (deferred until created)
  OAUTH_KV: KVNamespace;
  NONCE_KV: KVNamespace;
  ROLE_CACHE: KVNamespace;
  ENS_CACHE: KVNamespace;
  RERANK_CACHE: KVNamespace;
  SYNC_STATE: KVNamespace;

  // R2 Bucket
  KNOWLEDGE: R2Bucket;

  // Vectorize Index
  VECTORIZE: VectorizeIndex;

  // Workflow
  SYNC_WORKFLOW: Workflow;
}
