/**
 * MCP Tool registrations — Phase 1: read-only, no auth.
 *
 * 7 tools: search_knowledge, define_term, search_lexicon,
 * list_groups, list_releases, get_document, search_with_documents.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ContentType, R2Document } from '../types';
import { ContentTypeSchema, SearchFiltersSchema } from '../types';
import { searchKnowledge, getDocument } from '../retrieval';

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Get definition of a term from the lexicon (tags with contentType 'tag').
 */
async function getTermDefinition(term: string, env: Env): Promise<string | null> {
  const tagId = term.toLowerCase().replace(/\s+/g, '-');
  const doc = await getDocument('tag' as ContentType, tagId, env);
  if (!doc) return null;
  return (doc.metadata.description as string) || doc.content;
}

/**
 * Search lexicon entries by keyword.
 */
async function searchLexicon(
  keyword: string,
  env: Env,
): Promise<Array<{ term: string; description: string }>> {
  const results = await searchKnowledge(keyword, { contentType: 'tag' }, {}, env);
  return results.map((r) => ({
    term: r.title,
    description: r.description || '',
  }));
}

/**
 * List all groups from R2.
 */
async function listGroups(
  env: Env,
): Promise<Array<{ id: string; title: string; description?: string }>> {
  const prefix = 'content/group/';
  const allObjects: R2Object[] = [];
  let cursor: string | undefined;
  do {
    const listed = await env.KNOWLEDGE.list({ prefix, ...(cursor ? { cursor } : {}) });
    allObjects.push(...listed.objects);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  const groups: Array<{ id: string; title: string; description?: string }> = [];
  for (const obj of allObjects) {
    const data = await env.KNOWLEDGE.get(obj.key);
    if (data) {
      const doc: R2Document = await data.json();
      groups.push({
        id: doc.id,
        title: (doc.metadata.title as string) || doc.id,
        description: doc.metadata.description as string,
      });
    }
  }
  return groups;
}

/**
 * List all releases from R2 (unique release values from document metadata).
 */
async function listReleases(
  env: Env,
): Promise<Array<{ id: string; title: string; description?: string }>> {
  const prefix = 'content/';
  const allObjects: R2Object[] = [];
  let cursor: string | undefined;
  do {
    const listed = await env.KNOWLEDGE.list({ prefix, ...(cursor ? { cursor } : {}) });
    allObjects.push(...listed.objects);
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  const releaseSet = new Map<string, { id: string; title: string; description?: string }>();
  for (const obj of allObjects) {
    const data = await env.KNOWLEDGE.get(obj.key);
    if (data) {
      const doc: R2Document = await data.json();
      const release = doc.metadata.release as string;
      if (release && !releaseSet.has(release)) {
        releaseSet.set(release, {
          id: release,
          title: release,
          description: `Creative release: ${release}`,
        });
      }
    }
  }
  return Array.from(releaseSet.values());
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTools(server: McpServer, env: Env): void {
  server.tool(
    'search_knowledge',
    'Search the SuperBenefit knowledge base for documents about DAO patterns, ' +
      'governance practices, regenerative economics, and web3 coordination. ' +
      'Returns semantically similar content chunks with metadata.',
    {
      query: z.string().max(5000).describe('Natural language search query'),
      filters: z
        .object({
          contentType: ContentTypeSchema.optional().describe(
            'Filter by content type (pattern, tag, article, etc.)',
          ),
          group: z.string().max(200).optional().describe('Filter by group/cell (dao-primitives, allinforsport)'),
          release: z.string().max(200).optional().describe('Filter by creative release'),
        })
        .optional(),
    },
    async ({ query, filters }) => {
      const results = await searchKnowledge(query, filters || {}, {}, env);
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    },
  );

  server.tool(
    'define_term',
    "Get the definition of a term from the SuperBenefit lexicon. " +
      "Use this when users ask 'what is X?' for DAO/web3 terminology.",
    { term: z.string().max(200).describe('Term to define') },
    async ({ term }) => {
      const definition = await getTermDefinition(term, env);
      return {
        content: [
          {
            type: 'text',
            text: definition || `Term "${term}" not found in lexicon.`,
          },
        ],
      };
    },
  );

  server.tool(
    'search_lexicon',
    'Search lexicon entries by keyword. Returns matching terms with definitions.',
    { keyword: z.string().max(200).describe('Keyword to search') },
    async ({ keyword }) => {
      const results = await searchLexicon(keyword, env);
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    },
  );

  server.tool('list_groups', 'List all groups/cells in the SuperBenefit ecosystem.', {}, async () => {
    const groups = await listGroups(env);
    return { content: [{ type: 'text', text: JSON.stringify(groups, null, 2) }] };
  });

  server.tool('list_releases', 'List creative releases with their metadata.', {}, async () => {
    const releases = await listReleases(env);
    return { content: [{ type: 'text', text: JSON.stringify(releases, null, 2) }] };
  });

  server.tool(
    'get_document',
    'Get the full content of a document by its contentType and ID.',
    {
      contentType: ContentTypeSchema.describe('Content type of the document'),
      id: z.string().max(64).describe('Document ID'),
    },
    async ({ contentType, id }) => {
      const doc = await getDocument(contentType, id, env);
      if (!doc) {
        return { content: [{ type: 'text', text: 'Document not found' }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(doc, null, 2) }] };
    },
  );

  server.tool(
    'search_with_documents',
    'Search and return full document content for results.',
    {
      query: z.string().max(5000).describe('Search query'),
      filters: SearchFiltersSchema.optional(),
    },
    async ({ query, filters }) => {
      const results = await searchKnowledge(query, filters || {}, { includeDocuments: true }, env);
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    },
  );
}
