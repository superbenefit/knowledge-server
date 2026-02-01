import { z } from '@hono/zod-openapi';

// Sync workflow params (spec section 5.2)
export const SyncParamsSchema = z.object({
  changedFiles: z.array(z.string()),
  deletedFiles: z.array(z.string()),
  commitSha: z.string(),
});

export type SyncParams = z.infer<typeof SyncParamsSchema>;

// R2 event notification shape (spec section 5.3 / 6.2)
export const R2EventNotificationSchema = z.object({
  account: z.string(),
  bucket: z.string(),
  object: z.object({
    key: z.string(),
    size: z.number(),
    eTag: z.string(),
  }),
  action: z.enum(['PutObject', 'DeleteObject', 'CompleteMultipartUpload', 'CopyObject']),
  eventTime: z.string().datetime(),
});

export type R2EventNotification = z.infer<typeof R2EventNotificationSchema>;

// Sync status for tracking in KV
export const SyncStatusSchema = z.object({
  lastCommitSha: z.string(),
  lastSyncedAt: z.string().datetime(),
  totalFiles: z.number(),
  errors: z.array(
    z.object({
      path: z.string(),
      error: z.string(),
      timestamp: z.string().datetime(),
    })
  ),
});

export type SyncStatus = z.infer<typeof SyncStatusSchema>;
