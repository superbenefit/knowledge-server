import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';
import type { SyncParams } from '../types/sync';
import { inferContentType } from '../types/content';
import { generateId, toR2Key } from '../types/storage';
import type { R2Document } from '../types/storage';
import { parseMarkdown, shouldSync, resolveContentType, extractAttachmentRefs } from './parser';
import { fetchFileContent, fetchFileBinary } from './github';

/**
 * KnowledgeSyncWorkflow — Cloudflare Workflow that syncs markdown files
 * from GitHub to R2.
 *
 * Triggered by the webhook handler with a list of changed/deleted files
 * and the commit SHA. Each file is processed as an independent step with
 * its own retry policy.
 *
 * Only published, non-draft content is stored. Unpublished files that
 * previously existed are deleted from R2 (treated as "unpublished").
 */
export class KnowledgeSyncWorkflow extends WorkflowEntrypoint<Env, SyncParams> {
  async run(event: Readonly<WorkflowEvent<SyncParams>>, step: WorkflowStep) {
    const { changedFiles, deletedFiles, commitSha } = event.payload;

    // One-time migration: move content/index/index.json → indexes/index.json
    await step.do(
      'migrate-index-key',
      {
        retries: { limit: 2, delay: '5 seconds', backoff: 'constant' },
        timeout: '30 seconds',
      },
      async () => {
        const staleKey = 'content/index/index.json';
        const obj = await this.env.KNOWLEDGE.get(staleKey);
        if (obj) {
          const body = await obj.text();
          await this.env.KNOWLEDGE.put('indexes/index.json', body);
          await this.env.KNOWLEDGE.delete(staleKey);
          console.log('Migrated content/index/index.json → indexes/index.json');
        }
      },
    );

    // Process changed/added files — collect attachment refs from each synced file
    const allAttachmentRefs: string[] = [];
    for (const filePath of changedFiles) {
      const attachmentRefs = await step.do(
        `sync-${filePath}`,
        {
          retries: { limit: 5, delay: '30 seconds', backoff: 'exponential' },
          timeout: '2 minutes',
        },
        async (): Promise<string[]> => {
          // Fetch file content from GitHub
          let raw: string;
          try {
            raw = await fetchFileContent(
              filePath,
              commitSha,
              this.env.GITHUB_REPO,
              this.env.GITHUB_TOKEN,
            );
          } catch (err: unknown) {
            const status = (err as any).status;
            if (status === 404) {
              throw new NonRetryableError(`File not found: ${filePath}`);
            }
            if (status === 403) {
              throw new NonRetryableError(`GitHub API forbidden (invalid token?): ${filePath}`);
            }
            // 429, 5xx etc. will be retried by the workflow step
            throw err;
          }

          // Parse frontmatter and body
          const parsed = parseMarkdown(raw);

          // If YAML parsing failed, skip this file instead of deleting existing data
          if (parsed.parseError) {
            console.log(`Skipping ${filePath}: YAML parse error — ${parsed.parseError}`);
            throw new NonRetryableError(`YAML parse error in ${filePath}: ${parsed.parseError}`);
          }

          // Only sync published, non-draft content
          if (!shouldSync(parsed.frontmatter)) {
            // If this file was previously synced but is now unpublished,
            // clean it up from R2
            const contentType = resolveContentType(parsed.frontmatter, filePath);
            const id = generateId(filePath);
            const key = toR2Key(contentType, id);
            const existing = await this.env.KNOWLEDGE.head(key);
            if (existing) {
              await this.env.KNOWLEDGE.delete(key);
              console.log(`Deleted ${filePath}: unpublished or draft`);
            } else {
              console.log(`Skipped ${filePath}: not published or is draft`);
            }
            return [];
          }

          const contentType = resolveContentType(parsed.frontmatter, filePath);
          const id = generateId(filePath);

          const r2Doc: R2Document = {
            id,
            contentType,
            path: filePath,
            metadata: parsed.frontmatter,
            content: parsed.body,
            syncedAt: new Date().toISOString(),
            commitSha,
          };

          try {
            await this.env.KNOWLEDGE.put(
              toR2Key(contentType, id),
              JSON.stringify(r2Doc),
            );
            console.log(`Synced ${filePath} as ${contentType}/${id}`);
          } catch (err) {
            console.error(`R2 put failed for ${filePath}:`, err instanceof Error ? err.message : err);
            throw err;
          }

          return extractAttachmentRefs(parsed.body, raw);
        },
      );
      allAttachmentRefs.push(...attachmentRefs);
    }

    // Sync attachments referenced in published content (deduplicated)
    const uniqueAttachments = [...new Set(allAttachmentRefs)];
    for (const attachmentPath of uniqueAttachments) {
      await step.do(
        `sync-attachment-${attachmentPath}`,
        {
          retries: { limit: 3, delay: '30 seconds', backoff: 'exponential' },
          timeout: '2 minutes',
        },
        async () => {
          const buffer = await fetchFileBinary(
            attachmentPath,
            commitSha,
            this.env.GITHUB_REPO,
            this.env.GITHUB_TOKEN,
          );
          await this.env.KNOWLEDGE.put(attachmentPath, buffer);
          console.log(`Synced attachment: ${attachmentPath}`);
        },
      );
    }

    // Process deleted files
    for (const filePath of deletedFiles) {
      await step.do(
        `delete-${filePath}`,
        {
          retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' },
          timeout: '30 seconds',
        },
        async () => {
          const contentType = inferContentType(filePath);
          const id = generateId(filePath);
          await this.env.KNOWLEDGE.delete(toR2Key(contentType, id));
          console.log(`Deleted ${filePath} (${contentType}/${id}) — removed from Git`);
        },
      );
    }

    // Generate content manifest for zero-credential garden loader.
    // Lists all content/ objects and writes indexes/all-content.json with the key list.
    await step.do(
      'generate-content-manifest',
      {
        retries: { limit: 3, delay: '10 seconds', backoff: 'exponential' },
        timeout: '2 minutes',
      },
      async () => {
        async function listPrefix(bucket: R2Bucket, prefix: string): Promise<string[]> {
          const keys: string[] = [];
          let cursor: string | undefined;
          do {
            const listed = await bucket.list({ prefix, ...(cursor ? { cursor } : {}) });
            for (const obj of listed.objects) keys.push(obj.key);
            cursor = listed.truncated ? listed.cursor : undefined;
          } while (cursor);
          return keys;
        }

        const MANIFEST_KEY = 'indexes/all-content.json';
        const [keys, indexKeys, attachmentKeys] = await Promise.all([
          listPrefix(this.env.KNOWLEDGE, 'content/'),
          listPrefix(this.env.KNOWLEDGE, 'indexes/').then((k) =>
            k.filter((key) => key !== MANIFEST_KEY),
          ),
          listPrefix(this.env.KNOWLEDGE, 'attachments/'),
        ]);

        const manifest: R2Document = {
          id: 'all-content',
          contentType: 'index',
          path: MANIFEST_KEY,
          metadata: { keys, indexKeys, attachmentKeys },
          content: '',
          syncedAt: new Date().toISOString(),
          commitSha,
        };

        await this.env.KNOWLEDGE.put(MANIFEST_KEY, JSON.stringify(manifest));
        console.log(
          `Manifest written: ${keys.length} content keys, ${indexKeys.length} index keys, ${attachmentKeys.length} attachment keys`,
        );
      },
    );

    // Trigger AI Search reindex after all sync steps complete.
    // Non-fatal — AI Search auto-reindexes every 6h anyway. Never retried or thrown.
    await step.do(
      'trigger-ai-search-reindex',
      {
        retries: { limit: 0, delay: '1 second' },
        timeout: '30 seconds',
      },
      async () => {
        try {
          const url = `https://api.cloudflare.com/client/v4/accounts/${this.env.CF_ACCOUNT_ID}/ai-search/instances/knowledge-search/jobs`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.env.AI_SEARCH_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
          });
          if (!res.ok) {
            console.warn(`AI Search reindex trigger failed: ${res.status} ${res.statusText}`);
          } else {
            console.log('AI Search reindex triggered');
          }
        } catch (err) {
          console.warn('AI Search reindex trigger error (non-fatal):', err instanceof Error ? err.message : err);
        }
      },
    );
  }
}
