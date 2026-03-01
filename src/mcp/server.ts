import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools';

export function createMcpServer(env: Env): McpServer {
  const server = new McpServer({
    name: 'superbenefit-knowledge',
    version: '1.0.0',
  });
  registerTools(server, env);
  return server;
}
