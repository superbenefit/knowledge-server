/**
 * Main entry point for the SuperBenefit Knowledge Server.
 *
 * Routes:
 * - /api/v1/* — Public REST API (no auth, through Hono)
 * - /mcp, /mcp/* — MCP server (direct to handler, bypasses Hono)
 * - /webhook — GitHub webhook (direct handler)
 *
 * Phase 1: No authentication. All tools are Open tier.
 * Phase 2: Add Access JWT parsing before MCP dispatch.
 */

import { Hono } from 'hono';
import { createMcpHandler } from 'agents/mcp';
import { api } from './api/routes';
import { createMcpServer } from './mcp/server';
import { handleVectorizeQueue } from './consumers/vectorize';
import { verifyWebhookSignature, isExcluded } from './sync/github';
import type { GitHubPushEvent } from './types/sync';

// Re-export workflow class so Cloudflare can discover it via wrangler.jsonc class_name
export { KnowledgeSyncWorkflow } from './sync/workflow';

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  const deliveryId = request.headers.get('x-github-delivery');

  if (!await verifyWebhookSignature(body, signature, env.GITHUB_WEBHOOK_SECRET)) {
    return new Response('Invalid signature', { status: 403 });
  }

  // Security: Replay protection via delivery ID nonce
  if (deliveryId) {
    const nonceKey = `webhook:${deliveryId}`;
    const existing = await env.SYNC_STATE.get(nonceKey);
    if (existing) {
      return Response.json({ status: 'duplicate', deliveryId });
    }
    // Mark as processed with 24h TTL
    await env.SYNC_STATE.put(nonceKey, Date.now().toString(), { expirationTtl: 86400 });
  }

  const payload: GitHubPushEvent = JSON.parse(body);

  // Only process pushes to main branch
  if (payload.ref !== 'refs/heads/main') {
    return Response.json({ status: 'ignored', reason: 'not main branch' });
  }

  // Collect changed and deleted files from all commits
  const changedFiles = payload.commits
    .flatMap((c) => [...c.added, ...c.modified])
    .filter((f) => f.endsWith('.md') && !isExcluded(f));
  const deletedFiles = payload.commits
    .flatMap((c) => c.removed)
    .filter((f) => f.endsWith('.md'));

  // Deduplicate
  const uniqueChanged = [...new Set(changedFiles)];
  const uniqueDeleted = [...new Set(deletedFiles)];

  if (uniqueChanged.length === 0 && uniqueDeleted.length === 0) {
    return Response.json({ status: 'ignored', reason: 'no markdown files changed' });
  }

  // Trigger sync workflow
  await env.SYNC_WORKFLOW.create({
    params: {
      changedFiles: uniqueChanged,
      deletedFiles: uniqueDeleted,
      commitSha: payload.after,
    },
  });

  return Response.json({
    status: 'ok',
    changed: uniqueChanged.length,
    deleted: uniqueDeleted.length,
  });
}

// ---------------------------------------------------------------------------
// Hono app — mounts public REST API
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Env }>();

// Public REST API (no auth required)
app.route('/api/v1', api);

// ---------------------------------------------------------------------------
// Export Worker module
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // MCP server — direct to handler, bypassing Hono
    if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) {
      const server = createMcpServer(env);
      const handler = createMcpHandler(server, {
        route: '/mcp',
        corsOptions: {
          origin: '*',
          // Security: DELETE removed until Phase 3 auth is implemented
          methods: 'GET, POST, OPTIONS',
          headers: 'Content-Type, Accept, Authorization, Mcp-Session-Id',
        },
      });
      return handler(request, env, ctx);
    }

    // GitHub webhook
    if (url.pathname === '/webhook' && request.method === 'POST') {
      return handleWebhook(request, env);
    }

    // Everything else through Hono (REST API, health checks)
    return app.fetch(request, env, ctx);
  },
  queue: handleVectorizeQueue,
};
