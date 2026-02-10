/**
 * MCP Tool registrations with porch access control framework.
 *
 * Phase 1: All tools are Open tier (no authentication required).
 * Phase 3: get_document, search_with_documents become Members tier.
 *
 * See porch-spec.md v0.14 for tier definitions.
 *
 * TODO Phase 2: Implement rate limiting using SYNC_STATE KV
 * Pattern: Track calls per IP/session with sliding window.
 * Recommended limits: 100 requests/minute for open tier.
 * Unlimited tool calls can exhaust Vectorize/R2 quotas.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ContentType, R2Document, AuthContext } from '../types';
import { ContentTypeSchema, SearchFiltersSchema } from '../types';
import { searchKnowledge, getDocument } from '../retrieval';
import { toR2Key, generateId } from '../types/storage';
import { resolveAuthContext } from '../auth/resolve';
import { checkTierAccess } from '../auth/check';

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Extract and validate author ID from auth context.
 * Returns 'anonymous' for Phase 1, validated userId for Phase 2/3.
 * Security: Validates format to prevent spoofing in future phases.
 */
function getAuthorId(authContext: AuthContext): string {
  if (!authContext.identity?.userId) {
    return 'anonymous';
  }
  const userId = authContext.identity.userId;
  // Validate format: alphanumeric with hyphens/underscores, 3-64 chars
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(userId)) {
    console.warn(`Invalid userId format: ${userId}`);
    return 'anonymous';
  }
  return userId;
}

/**
 * Get definition of a term from the lexicon (tags with contentType 'tag').
 */
async function getTermDefinition(term: string, env: Env): Promise<string | null> {
  // Look up tag by ID (lowercase, hyphenated)
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
  const listed = await env.KNOWLEDGE.list({ prefix: 'content/group/' });
  const groups: Array<{ id: string; title: string; description?: string }> = [];

  for (const obj of listed.objects) {
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
 * List all releases from R2 (documents with release metadata).
 */
async function listReleases(
  env: Env,
): Promise<Array<{ id: string; title: string; description?: string }>> {
  // Releases are stored as metadata on resources, not as separate documents.
  // For now, return unique release values from resource documents.
  const listed = await env.KNOWLEDGE.list({ prefix: 'content/' });
  const releaseSet = new Map<string, { id: string; title: string; description?: string }>();

  for (const obj of listed.objects) {
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

/**
 * Save a new link to R2.
 */
async function saveLink(
  params: { url: string; title: string; description?: string },
  authorId: string,
  env: Env,
): Promise<void> {
  const id = generateId(params.title.toLowerCase().replace(/\s+/g, '-') + '.md');
  const doc: R2Document = {
    id,
    contentType: 'link',
    path: `links/${id}.md`,
    metadata: {
      title: params.title,
      description: params.description || '',
      url: params.url,
      author: [authorId],
      date: new Date().toISOString(),
      publish: false, // Drafts until reviewed
      draft: true,
    },
    content: `# ${params.title}\n\n${params.description || ''}\n\n[Link](${params.url})`,
    syncedAt: new Date().toISOString(),
    commitSha: 'user-submitted',
  };

  await env.KNOWLEDGE.put(toR2Key('link', id), JSON.stringify(doc));
}

/**
 * Create a new draft document in R2.
 */
async function createDraft(
  params: { contentType: ContentType; title: string; content: string },
  authorId: string,
  env: Env,
): Promise<R2Document> {
  const id = generateId(params.title.toLowerCase().replace(/\s+/g, '-') + '.md');
  const doc: R2Document = {
    id,
    contentType: params.contentType,
    path: `drafts/${params.contentType}/${id}.md`,
    metadata: {
      title: params.title,
      type: params.contentType,
      author: [authorId],
      date: new Date().toISOString(),
      publish: false,
      draft: true,
    },
    content: params.content,
    syncedAt: new Date().toISOString(),
    commitSha: 'user-draft',
  };

  await env.KNOWLEDGE.put(toR2Key(params.contentType, id), JSON.stringify(doc));
  return doc;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerTools(server: McpServer, env: Env): void {
  // -------------------------------------------------------------------------
  // Open tools (Phase 1: all tools are open)
  // -------------------------------------------------------------------------

  server.tool(
    'search_knowledge',
    'Search the SuperBenefit knowledge base for documents about DAO patterns, ' +
      'governance practices, regenerative economics, and web3 coordination. ' +
      'Returns semantically similar content chunks with metadata.',
    {
      query: z.string().describe('Natural language search query'),
      filters: z
        .object({
          contentType: ContentTypeSchema.optional().describe(
            'Filter by content type (pattern, tag, article, etc.)',
          ),
          group: z.string().optional().describe('Filter by group/cell (dao-primitives, allinforsport)'),
          release: z.string().optional().describe('Filter by creative release'),
        })
        .optional(),
    },
    async ({ query, filters }) => {
      const authContext = await resolveAuthContext(env);
      const access = checkTierAccess('open', authContext);
      if (!access.allowed) {
        return {
          content: [{ type: 'text', text: `Requires ${access.requiredTier} access. Current: ${access.currentTier}.` }],
          isError: true,
        };
      }
      const results = await searchKnowledge(query, filters || {}, {}, env);
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    },
  );

  server.tool(
    'define_term',
    "Get the definition of a term from the SuperBenefit lexicon. " +
      "Use this when users ask 'what is X?' for DAO/web3 terminology.",
    { term: z.string().describe('Term to define') },
    async ({ term }) => {
      const authContext = await resolveAuthContext(env);
      const access = checkTierAccess('open', authContext);
      if (!access.allowed) {
        return {
          content: [{ type: 'text', text: `Requires ${access.requiredTier} access. Current: ${access.currentTier}.` }],
          isError: true,
        };
      }
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
    { keyword: z.string().describe('Keyword to search') },
    async ({ keyword }) => {
      const authContext = await resolveAuthContext(env);
      const access = checkTierAccess('open', authContext);
      if (!access.allowed) {
        return {
          content: [{ type: 'text', text: `Requires ${access.requiredTier} access. Current: ${access.currentTier}.` }],
          isError: true,
        };
      }
      const results = await searchLexicon(keyword, env);
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    },
  );

  server.tool('list_groups', 'List all groups/cells in the SuperBenefit ecosystem.', {}, async () => {
    const authContext = await resolveAuthContext(env);
    const access = checkTierAccess('open', authContext);
    if (!access.allowed) {
      return {
        content: [{ type: 'text', text: `Requires ${access.requiredTier} access. Current: ${access.currentTier}.` }],
        isError: true,
      };
    }
    const groups = await listGroups(env);
    return { content: [{ type: 'text', text: JSON.stringify(groups, null, 2) }] };
  });

  server.tool('list_releases', 'List creative releases with their metadata.', {}, async () => {
    const authContext = await resolveAuthContext(env);
    const access = checkTierAccess('open', authContext);
    if (!access.allowed) {
      return {
        content: [{ type: 'text', text: `Requires ${access.requiredTier} access. Current: ${access.currentTier}.` }],
        isError: true,
      };
    }
    const releases = await listReleases(env);
    return { content: [{ type: 'text', text: JSON.stringify(releases, null, 2) }] };
  });

  // -------------------------------------------------------------------------
  // Phase 1: These tools are temporarily Open; will become Members in Phase 3
  // -------------------------------------------------------------------------

  server.tool(
    'get_document',
    'Get the full content of a document by its contentType and ID.',
    {
      contentType: ContentTypeSchema.describe('Content type of the document'),
      id: z.string().describe('Document ID'),
    },
    async ({ contentType, id }) => {
      const authContext = await resolveAuthContext(env);
      // Phase 1: 'open'; Phase 3: change to 'members'
      const access = checkTierAccess('open', authContext);
      if (!access.allowed) {
        return {
          content: [{ type: 'text', text: `Requires ${access.requiredTier} access. Current: ${access.currentTier}.` }],
          isError: true,
        };
      }

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
      query: z.string().describe('Search query'),
      filters: SearchFiltersSchema.optional(),
    },
    async ({ query, filters }) => {
      const authContext = await resolveAuthContext(env);
      // Phase 1: 'open'; Phase 3: change to 'members'
      const access = checkTierAccess('open', authContext);
      if (!access.allowed) {
        return {
          content: [{ type: 'text', text: `Requires ${access.requiredTier} access. Current: ${access.currentTier}.` }],
          isError: true,
        };
      }

      const results = await searchKnowledge(query, filters || {}, { includeDocuments: true }, env);
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    },
  );

  server.tool(
    'save_link',
    'Save a new link to the library.',
    {
      url: z.string().url().describe('URL to save'),
      title: z.string().describe('Link title'),
      description: z.string().optional().describe('Brief description'),
    },
    async (params) => {
      const authContext = await resolveAuthContext(env);
      // Phase 1: 'open'; Phase 3: change to 'members'
      const access = checkTierAccess('open', authContext);
      if (!access.allowed) {
        return {
          content: [{ type: 'text', text: `Requires ${access.requiredTier} access. Current: ${access.currentTier}.` }],
          isError: true,
        };
      }

      const authorId = getAuthorId(authContext);
      await saveLink(params, authorId, env);
      return { content: [{ type: 'text', text: 'Link saved successfully' }] };
    },
  );

  server.tool(
    'create_draft',
    'Create a new draft document in the knowledge base.',
    {
      contentType: ContentTypeSchema.describe('Type of content to create'),
      title: z.string().describe('Document title'),
      content: z.string().describe('Markdown content'),
    },
    async (params) => {
      const authContext = await resolveAuthContext(env);
      // Phase 1: 'open'; Phase 3: change to 'members'
      const access = checkTierAccess('open', authContext);
      if (!access.allowed) {
        return {
          content: [{ type: 'text', text: `Requires ${access.requiredTier} access. Current: ${access.currentTier}.` }],
          isError: true,
        };
      }

      const authorId = getAuthorId(authContext);
      const draft = await createDraft(params, authorId, env);
      return { content: [{ type: 'text', text: JSON.stringify(draft, null, 2) }] };
    },
  );
}

// Export helper functions for use in resources
export { listGroups, listReleases };
