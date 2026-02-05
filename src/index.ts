/**
 * Main entry point for the SuperBenefit Knowledge Server.
 *
 * Routes:
 * - /api/v1/* — Public REST API (no auth)
 * - /mcp/* — MCP server (OAuth/SIWE protected)
 * - /authorize, /token, /register — OAuth endpoints
 * - /siwe/* — SIWE authentication flow
 */

import OAuthProvider from '@cloudflare/workers-oauth-provider';
import { Hono } from 'hono';
import { GitHubHandler } from './github-handler';
import { api } from './api/routes';
import { McpHandler } from './mcp';
import { handleVectorizeQueue } from './consumers/vectorize';

// Re-export workflow class so Cloudflare can discover it via wrangler.jsonc class_name
export { KnowledgeSyncWorkflow } from './sync/workflow';

// ---------------------------------------------------------------------------
// OAuth Provider — wraps MCP handler with OAuth/SIWE auth
// ---------------------------------------------------------------------------

// Type assertions needed because OAuthProvider uses generic `unknown` env
// while our handlers are typed with specific Env binding.
// The handlers implement the required fetch signature but with stricter env types.
const oauthProvider = new OAuthProvider({
  apiHandler: McpHandler as { fetch: ExportedHandlerFetchHandler },
  apiRoute: '/mcp',
  authorizeEndpoint: '/authorize',
  clientRegistrationEndpoint: '/register',
  defaultHandler: GitHubHandler as { fetch: ExportedHandlerFetchHandler },
  tokenEndpoint: '/token',
});

// ---------------------------------------------------------------------------
// Main Hono app — mounts public REST API and delegates MCP/OAuth routes
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Env }>();

// Public REST API (no auth required)
app.route('/api/v1', api);

// MCP server + OAuth endpoints — delegate to OAuthProvider
app.all('*', (c) => oauthProvider.fetch(c.req.raw, c.env, c.executionCtx));

// ---------------------------------------------------------------------------
// Export Worker module
// ---------------------------------------------------------------------------

export default {
  fetch: app.fetch,
  queue: handleVectorizeQueue,
};
