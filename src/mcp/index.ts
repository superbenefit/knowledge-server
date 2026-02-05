/**
 * MCP module re-exports.
 *
 * Provides clean imports for MCP server components:
 * - McpHandler: Stateless handler for OAuthProvider integration
 * - createKnowledgeServer: Factory for configured McpServer instances
 * - Registration functions: registerTools, registerResources, registerPrompts
 */

export { McpHandler, createKnowledgeServer } from './server';
export { registerTools, listGroups, listReleases } from './tools';
export { registerResources } from './resources';
export { registerPrompts } from './prompts';
