import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';
import type { SyncParams } from '../types/sync';
import { inferContentType } from '../types/content';
import { generateId, toR2Key } from '../types/storage';
import type { R2Document } from '../types/storage';
import { parseMarkdown, shouldSync, resolveContentType } from './parser';
import { fetchFileContent } from './github';

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

    // Process changed/added files
    for (const filePath of changedFiles) {
      await step.do(
        `sync-${filePath}`,
        {
          retries: { limit: 5, delay: '30 seconds', backoff: 'exponential' },
          timeout: '2 minutes',
        },
        async () => {
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
            return;
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
        },
      );
    }

    // Process deleted files
    for (const filePath of deletedFiles) {
      await step.do(`delete-${filePath}`, async () => {
        const contentType = inferContentType(filePath);
        const id = generateId(filePath);
        await this.env.KNOWLEDGE.delete(toR2Key(contentType, id));
        console.log(`Deleted ${filePath} (${contentType}/${id}) — removed from Git`);
      });
    }
  }
}
