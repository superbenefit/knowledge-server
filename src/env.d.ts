// Extend the generated Env interface with secrets
// Secrets are set via `wrangler secret put` and aren't in wrangler.jsonc

// Augment the Cloudflare namespace (used by cloudflare:workers import)
declare namespace Cloudflare {
  interface Env {
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    COOKIE_ENCRYPTION_KEY: string;
  }
}

// Also extend the global Env interface (used by Hono bindings)
interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  COOKIE_ENCRYPTION_KEY: string;
}
