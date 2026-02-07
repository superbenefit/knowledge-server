/**
 * Stateless MCP server factory.
 *
 * Creates a new McpServer instance per-request (CVE GHSA-qgp8-v765-qxx9).
 * Tools, resources, and prompts are registered on each instance.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools';
import { registerResources } from './resources';
import { registerPrompts } from './prompts';

/**
 * Create a fully configured MCP server instance.
 */
export function createMcpServer(env: Env): McpServer {
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
