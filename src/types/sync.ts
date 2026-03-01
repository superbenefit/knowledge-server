import { z } from 'zod';

// ---------------------------------------------------------------------------
// Sync workflow params (spec section 5.2)
// ---------------------------------------------------------------------------

export const SyncParamsSchema = z.object({
  changedFiles: z.array(z.string()),
  deletedFiles: z.array(z.string()),
  commitSha: z.string(),
});

export type SyncParams = z.infer<typeof SyncParamsSchema>;

// ---------------------------------------------------------------------------
// GitHub webhook push event (subset of fields we use)
// ---------------------------------------------------------------------------

export interface GitHubPushEvent {
  ref: string;
  after: string;
  commits: Array<{
    added: string[];
    modified: string[];
    removed: string[];
  }>;
}

// ---------------------------------------------------------------------------
// Parsed markdown result
// ---------------------------------------------------------------------------

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
  /** Set when YAML frontmatter parsing fails. Workflow should treat as NonRetryableError. */
  parseError?: string;
}
