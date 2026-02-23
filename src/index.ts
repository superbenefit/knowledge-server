/**
 * Main entry point for the SuperBenefit Knowledge Server.
 *
 * Extends WorkerEntrypoint to provide:
 * - HTTP routing: /api/v1/*, /mcp, /webhook
 * - Queue consumer for Vectorize indexing
 * - RPC methods for inter-Worker service binding calls
 *
 * Phase 1: No authentication. All tools/RPC are Open tier.
 * Phase 2: Add Access JWT parsing before MCP dispatch.
 */

import { WorkerEntrypoint } from 'cloudflare:workers';
import { Hono } from 'hono';
import { createMcpHandler } from 'agents/mcp';
import { api } from './api/routes';
import { createMcpServer } from './mcp/server';
import { handleVectorizeQueue } from './consumers/vectorize';
import { verifyWebhookSignature, isExcluded } from './sync/github';
import { SECURITY_HEADERS } from '@superbenefit/porch/security';
import { searchKnowledge, getDocument } from './retrieval';
import { listGroups, listReleases, getTermDefinition } from './mcp/tools';
import type { GitHubPushEvent } from './types/sync';
import type { SearchFilters, R2Document } from './types';
import type {
  SearchKnowledgeParams,
  SearchKnowledgeResult,
  GetDocumentParams,
  DefineTermParams,
  DefineTermResult,
  ListGroupsResult,
  ListReleasesResult,
} from './types/rpc';

// Re-export workflow class so Cloudflare can discover it via wrangler.jsonc class_name
export { KnowledgeSyncWorkflow } from './sync/workflow';

// ---------------------------------------------------------------------------
// Hono app — mounts public REST API
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Env }>();

// Root landing page
app.get('/', (c) => {
  // JSON for programmatic clients
  if (c.req.header('Accept')?.includes('application/json')) {
    return c.json({
      name: 'SuperBenefit Knowledge Server',
      version: '0.1.0',
      endpoints: {
        api: '/api/v1',
        docs: '/api/v1/docs',
        openapi: '/api/v1/openapi.json',
        mcp: '/mcp',
        health: '/api/v1/health',
      },
    });
  }
  // HTML for browsers
  return c.html(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SuperBenefit Knowledge Server</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0a0a0b;color:#e4e4e7;min-height:100vh;display:flex;align-items:center;justify-content:center}
.container{max-width:540px;width:100%;padding:2rem}
h1{font-size:1.5rem;font-weight:600;margin-bottom:.25rem}
.subtitle{color:#a1a1aa;font-size:.875rem;margin-bottom:2rem}
.version{display:inline-block;font-size:.75rem;color:#71717a;border:1px solid #27272a;border-radius:9999px;padding:.125rem .5rem;margin-left:.5rem;vertical-align:middle}
.section{margin-bottom:1.5rem}
.section-title{font-size:.75rem;font-weight:500;color:#71717a;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem}
a{color:#e4e4e7;text-decoration:none;display:flex;align-items:center;gap:.75rem;padding:.625rem .875rem;border-radius:.5rem;border:1px solid #27272a;background:#18181b;margin-bottom:.5rem;transition:border-color .15s,background .15s}
a:hover{border-color:#3f3f46;background:#1f1f23}
.label{font-size:.875rem;font-weight:500}
.path{font-size:.75rem;color:#71717a;font-family:ui-monospace,monospace}
.dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.dot-green{background:#22c55e}
.dot-blue{background:#3b82f6}
.dot-purple{background:#a855f7}
.footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #1c1c1f;font-size:.75rem;color:#52525b}
.footer a{display:inline;border:0;background:0;padding:0;color:#a855f7}
.footer a:hover{text-decoration:underline}
</style>
</head>
<body>
<div class="container">
  <h1>Knowledge Server<span class="version">v0.1.0</span></h1>
  <p class="subtitle">SuperBenefit knowledge base — public read-only API and MCP server</p>
  <div class="section">
    <div class="section-title">Endpoints</div>
    <a href="/api/v1/docs"><span class="dot dot-green"></span><span><span class="label">API Documentation</span><br><span class="path">/api/v1/docs</span></span></a>
    <a href="/api/v1/openapi.json"><span class="dot dot-blue"></span><span><span class="label">OpenAPI Spec</span><br><span class="path">/api/v1/openapi.json</span></span></a>
    <a href="/api/v1/entries"><span class="dot dot-blue"></span><span><span class="label">Entries</span><br><span class="path">/api/v1/entries</span></span></a>
    <a href="/api/v1/search?q=governance"><span class="dot dot-blue"></span><span><span class="label">Search</span><br><span class="path">/api/v1/search?q=…</span></span></a>
    <a href="/api/v1/health"><span class="dot dot-green"></span><span><span class="label">Health</span><br><span class="path">/api/v1/health</span></span></a>
  </div>
  <div class="section">
    <div class="section-title">MCP</div>
    <a href="/mcp"><span class="dot dot-purple"></span><span><span class="label">MCP Server</span><br><span class="path">/mcp</span></span></a>
  </div>
  <div class="footer">Part of the <a href="https://superbenefit.org">SuperBenefit</a> knowledge stack</div>
</div>
</body>
</html>`);
});

// Public REST API (no auth required)
app.route('/api/v1', api);

// ---------------------------------------------------------------------------
// WorkerEntrypoint — HTTP, queue, and RPC interface
// ---------------------------------------------------------------------------

export default class KnowledgeServer extends WorkerEntrypoint<Env> {
  /**
   * HTTP request handler — rate limiting, routing split.
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Rate limiting — key on client IP
    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const { success } = await this.env.RATE_LIMITER.limit({ key: clientIp });
    if (!success) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60', ...SECURITY_HEADERS },
      });
    }

    // MCP server — created per-request (WorkerEntrypoint: this.env unavailable at module scope)
    if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp/')) {
      const server = createMcpServer(this.env);
      const handler = createMcpHandler(server, {
        route: '/mcp',
        corsOptions: {
          origin: '*',
          // Security: DELETE removed until Phase 3 auth is implemented
          methods: 'GET, POST, OPTIONS',
          headers: 'Content-Type, Accept, Authorization, Mcp-Session-Id',
        },
      });
      const response = await handler(request, this.env, this.ctx);

      // Inject security headers into MCP response
      const securedResponse = new Response(response.body, response);
      for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        securedResponse.headers.set(key, value);
      }
      return securedResponse;
    }

    // GitHub webhook
    if (url.pathname === '/webhook' && request.method === 'POST') {
      return this.handleWebhook(request);
    }

    // Everything else through Hono (REST API, health checks)
    return app.fetch(request, this.env, this.ctx);
  }

  /**
   * Queue consumer — processes R2 event notifications for Vectorize indexing.
   */
  async queue(batch: MessageBatch<unknown>): Promise<void> {
    return handleVectorizeQueue(batch, this.env);
  }

  // -------------------------------------------------------------------------
  // Webhook handler — private, uses this.env and this.ctx
  // -------------------------------------------------------------------------

  private async handleWebhook(request: Request): Promise<Response> {
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    const deliveryId = request.headers.get('x-github-delivery');

    if (!await verifyWebhookSignature(body, signature, this.env.GITHUB_WEBHOOK_SECRET)) {
      return new Response('Invalid signature', { status: 403 });
    }

    // Security: Replay protection via delivery ID nonce
    if (deliveryId) {
      const nonceKey = `webhook:${deliveryId}`;
      const existing = await this.env.SYNC_STATE.get(nonceKey);
      if (existing) {
        return Response.json({ status: 'duplicate', deliveryId });
      }
      // Mark as processed with 24h TTL
      await this.env.SYNC_STATE.put(nonceKey, Date.now().toString(), { expirationTtl: 86400 });
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

    // Fire-and-forget workflow — respond immediately
    this.ctx.waitUntil(
      this.env.SYNC_WORKFLOW.create({
        params: {
          changedFiles: uniqueChanged,
          deletedFiles: uniqueDeleted,
          commitSha: payload.after,
        },
      })
    );

    return Response.json({
      status: 'ok',
      changed: uniqueChanged.length,
      deleted: uniqueDeleted.length,
    });
  }

  // -------------------------------------------------------------------------
  // RPC methods — callable via service bindings from other Workers
  // -------------------------------------------------------------------------

  /**
   * Search the knowledge base using three-stage retrieval pipeline.
   * Stage 1: Vectorize similarity search → Stage 2: BGE reranker → results
   */
  async searchKnowledge(params: SearchKnowledgeParams): Promise<SearchKnowledgeResult> {
    if (!params?.query || typeof params.query !== 'string' || params.query.trim() === '') {
      throw new Error('RPC searchKnowledge: query is required');
    }
    if (params.limit !== undefined && (params.limit < 1 || params.limit > 20)) {
      throw new Error('RPC searchKnowledge: limit must be 1-20');
    }

    const filters: SearchFilters = {};
    if (params.contentType) filters.contentType = params.contentType;
    if (params.group) filters.group = params.group;
    if (params.release) filters.release = params.release;

    const items = await searchKnowledge(params.query, filters, {}, this.env);
    const limited = params.limit ? items.slice(0, params.limit) : items;
    return { items: limited, total: items.length };
  }

  /**
   * Get a single document by content type and ID.
   * Returns null if not found.
   */
  async getDocument(params: GetDocumentParams): Promise<R2Document | null> {
    if (!params?.contentType || !params?.id) {
      throw new Error('RPC getDocument: contentType and id are required');
    }
    return getDocument(params.contentType, params.id, this.env);
  }

  /**
   * List all groups/cells in the SuperBenefit ecosystem.
   */
  async listGroups(): Promise<ListGroupsResult> {
    const groups = await listGroups(this.env);
    return { groups };
  }

  /**
   * List all creative releases with metadata.
   */
  async listReleases(): Promise<ListReleasesResult> {
    const releases = await listReleases(this.env);
    return { releases };
  }

  /**
   * Get the definition of a term from the SuperBenefit lexicon.
   */
  async defineTerm(params: DefineTermParams): Promise<DefineTermResult> {
    if (!params?.term || typeof params.term !== 'string' || params.term.trim() === '') {
      throw new Error('RPC defineTerm: term is required');
    }
    const definition = await getTermDefinition(params.term, this.env);
    return { term: params.term, definition };
  }
}
