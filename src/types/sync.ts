import { z } from '@hono/zod-openapi';

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
// R2 event notification payload (spec section 5.3)
// ---------------------------------------------------------------------------

export interface R2EventNotification {
  account: string;
  bucket: string;
  object: {
    key: string;
    size: number;
    eTag: string;
  };
  eventType: 'object-create' | 'object-delete';
  eventTime: string;
}

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
}
