/**
 * Stateless MCP server handler.
 *
 * Uses `createMcpHandler` from agents/mcp for stateless operation
 * (no Durable Object required).
 *
 * Registers all MCP primitives:
 * - Tools (10): search_knowledge, define_term, etc.
 * - Resources (4): prompts/knowledge-search, data/ontology, etc.
 * - Prompts (3): research-topic, explain-pattern, compare-practices
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpHandler } from 'agents/mcp';
import { registerTools } from './tools';
import { registerResources } from './resources';
import { registerPrompts } from './prompts';

/**
 * Create a fully configured MCP server instance.
 */
function createKnowledgeServer(env: Env): McpServer {
  const server = new McpServer({
    name: 'superbenefit-knowledge',
    version: '1.0.0',
  });

  // Register all primitives
  registerTools(server, env);
  registerResources(server, env);
  registerPrompts(server, env);

  return server;
}

/**
 * MCP handler for OAuthProvider integration.
 *
 * This is a stateless handler that creates a new McpServer instance
 * for each request. The server registers tools, resources, and prompts
 * but does not persist any state between requests.
 */
export const McpHandler = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const server = createKnowledgeServer(env);

    const handler = createMcpHandler(server, {
      route: '/mcp',
      corsOptions: {
        origin: '*',
        methods: 'GET, POST, DELETE, OPTIONS',
        headers: 'Content-Type, Authorization, Mcp-Session-Id',
      },
    });

    return handler(request, env, ctx);
  },
};

export { createKnowledgeServer };
