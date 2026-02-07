/**
 * MCP Resource registrations.
 *
 * Resources provide read-only context data that clients can inject into conversations.
 * (spec section 7.4)
 *
 * Resources:
 * - prompts/knowledge-search: System prompt for knowledge search
 * - data/ontology: Content type hierarchy JSON
 * - data/groups: List of groups/cells from R2
 * - data/releases: List of releases from R2
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listGroups, listReleases } from './tools';
import {
  ContentTypeSchema,
  RESOURCE_TYPES,
  STORY_TYPES,
  REFERENCE_TYPES,
  DATA_TYPES,
} from '../types/content';

// ---------------------------------------------------------------------------
// System prompt for knowledge search
// ---------------------------------------------------------------------------

const KNOWLEDGE_SEARCH_SYSTEM_PROMPT = `You are an AI assistant with access to the SuperBenefit knowledge base.

SuperBenefit is a DAO focused on regenerative economics, web3 coordination, and governance innovation.

When answering questions:
1. Use the search_knowledge tool to find relevant documents
2. Use define_term for DAO/web3 terminology
3. Cite sources with document IDs when referencing content
4. Distinguish between SuperBenefit's documented practices and general knowledge

The knowledge base contains:
- Patterns: Reusable governance and coordination patterns
- Practices: Documented implementations of patterns
- Primitives: Building blocks for DAO operations
- Protocols: Step-by-step coordination procedures
- Playbooks: Comprehensive guides for complex tasks
- Questions: Open research questions the community is exploring
- Studies: Case studies and retrospectives
- Articles: Curated external resources with commentary
- Tags: Lexicon entries defining key terms
- Links: External resource library

Always search before answering questions about SuperBenefit's work.`;

// ---------------------------------------------------------------------------
// Ontology schema
// ---------------------------------------------------------------------------

const ONTOLOGY_SCHEMA = {
  version: '0.16',
  contentTypes: ContentTypeSchema.options,
  hierarchy: {
    file: {
      description: 'Base type for all content',
      children: ['reference', 'resource', 'question', 'story', 'data'],
    },
    reference: {
      description: 'Reference materials',
      children: REFERENCE_TYPES,
    },
    resource: {
      description: 'Reusable knowledge artifacts',
      children: RESOURCE_TYPES,
    },
    question: {
      description: 'Open research questions (standalone)',
      children: [],
    },
    story: {
      description: 'Narrative content',
      children: STORY_TYPES,
    },
    data: {
      description: 'Structured data entities',
      children: DATA_TYPES,
    },
  },
  metadata: {
    required: ['title', 'date', 'publish'],
    optional: ['description', 'author', 'group', 'release', 'tags'],
    indexed: ['contentType', 'group', 'tags', 'release', 'status', 'date'],
  },
};

// ---------------------------------------------------------------------------
// Resource registration
// ---------------------------------------------------------------------------

export function registerResources(server: McpServer, env: Env): void {
  // System prompt for knowledge search
  server.resource(
    'prompts/knowledge-search',
    'mcp://superbenefit/prompts/knowledge-search',
    {
      description: 'System prompt optimized for SuperBenefit knowledge base search',
      mimeType: 'text/plain',
    },
    async () => ({
      contents: [
        {
          uri: 'mcp://superbenefit/prompts/knowledge-search',
          mimeType: 'text/plain',
          text: KNOWLEDGE_SEARCH_SYSTEM_PROMPT,
        },
      ],
    }),
  );

  // Ontology documentation
  server.resource(
    'data/ontology',
    'mcp://superbenefit/data/ontology',
    {
      description: 'Content type hierarchy and metadata schema documentation',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'mcp://superbenefit/data/ontology',
          mimeType: 'application/json',
          text: JSON.stringify(ONTOLOGY_SCHEMA, null, 2),
        },
      ],
    }),
  );

  // Groups list
  server.resource(
    'data/groups',
    'mcp://superbenefit/data/groups',
    {
      description: 'List of SuperBenefit groups/cells with metadata',
      mimeType: 'application/json',
    },
    async () => {
      const groups = await listGroups(env);
      return {
        contents: [
          {
            uri: 'mcp://superbenefit/data/groups',
            mimeType: 'application/json',
            text: JSON.stringify(groups, null, 2),
          },
        ],
      };
    },
  );

  // Releases list
  server.resource(
    'data/releases',
    'mcp://superbenefit/data/releases',
    {
      description: 'List of creative releases with metadata',
      mimeType: 'application/json',
    },
    async () => {
      const releases = await listReleases(env);
      return {
        contents: [
          {
            uri: 'mcp://superbenefit/data/releases',
            mimeType: 'application/json',
            text: JSON.stringify(releases, null, 2),
          },
        ],
      };
    },
  );
}
