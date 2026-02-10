/**
 * MCP Prompt registrations.
 *
 * Prompts are workflow templates that users explicitly invoke.
 * (spec section 7.5)
 *
 * Prompts:
 * - research-topic: Research a topic comprehensively
 * - explain-pattern: Explain a DAO pattern with examples
 * - compare-practices: Compare two governance practices
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// TODO Phase 2: Add checkTierAccess() before prompt orchestration
// Prompts can orchestrate tools without tier validation. When auth is added,
// prompts should validate access before generating tool invocation messages.

export function registerPrompts(server: McpServer, _env: Env): void {
  // Research workflow
  server.prompt(
    'research-topic',
    'Research a topic comprehensively across the SuperBenefit knowledge base',
    {
      topic: z.string().describe('Topic to research'),
      depth: z.enum(['shallow', 'deep']).optional().describe('Research depth: shallow or deep'),
    },
    async ({ topic, depth = 'shallow' }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Research the topic "${topic}" in the SuperBenefit knowledge base.

${
  depth === 'deep'
    ? `
Provide a comprehensive analysis including:
1. Core concepts and definitions from the lexicon
2. Related patterns and practices from artifacts
3. External resources from the library
4. Cross-references to other relevant topics
5. Gaps or areas needing more documentation
`
    : `
Provide a brief summary including:
1. Key definition from the lexicon
2. Most relevant artifact
3. One or two external resources
`
}

Use the search_knowledge and define_term tools as needed.`,
          },
        },
      ],
    }),
  );

  // Explain a DAO pattern
  server.prompt(
    'explain-pattern',
    "Explain a DAO pattern with examples and context from SuperBenefit's experience",
    { pattern: z.string().describe('Pattern name to explain') },
    async ({ pattern }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Explain the DAO pattern "${pattern}" as documented in SuperBenefit's knowledge base.

Include:
1. Definition from the lexicon
2. How it works in practice
3. Examples from SuperBenefit's experience
4. Related patterns
5. When to use vs. alternatives

Use the search_knowledge and define_term tools to find accurate information.`,
          },
        },
      ],
    }),
  );

  // Compare governance approaches
  server.prompt(
    'compare-practices',
    'Compare two governance or coordination practices',
    {
      practice1: z.string().describe('First practice to compare'),
      practice2: z.string().describe('Second practice to compare'),
    },
    async ({ practice1, practice2 }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Compare "${practice1}" and "${practice2}" as governance/coordination approaches.

Structure your comparison:
1. Brief definition of each
2. Key similarities
3. Key differences
4. When to use each
5. How they might complement each other

Use the search_knowledge tool to find relevant documentation for both.`,
          },
        },
      ],
    }),
  );
}
