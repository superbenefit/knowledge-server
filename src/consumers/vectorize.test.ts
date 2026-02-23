import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

// Mirror the schema from vectorize.ts for direct validation testing
const CREATE_ACTIONS = ['PutObject', 'CopyObject', 'CompleteMultipartUpload'] as const;
const DELETE_ACTIONS = ['DeleteObject', 'LifecycleDeletion'] as const;

const R2EventNotificationSchema = z.object({
  account: z.string(),
  action: z.enum([...CREATE_ACTIONS, ...DELETE_ACTIONS]),
  bucket: z.string(),
  object: z.object({
    key: z.string(),
    size: z.number().optional(),
    eTag: z.string().optional(),
  }),
  eventTime: z.string(),
  copySource: z.object({
    bucket: z.string(),
    object: z.string(),
  }).optional(),
});

describe('R2EventNotification schema', () => {
  it('validates a PutObject create event', () => {
    const event = {
      account: 'abc123',
      action: 'PutObject',
      bucket: 'superbenefit-knowledge',
      object: { key: 'content/pattern/test.json', size: 1024, eTag: '"abc"' },
      eventTime: '2025-01-01T00:00:00Z',
    };
    const result = R2EventNotificationSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('validates a DeleteObject event (no size/eTag)', () => {
    const event = {
      account: 'abc123',
      action: 'DeleteObject',
      bucket: 'superbenefit-knowledge',
      object: { key: 'content/tag/dao.json' },
      eventTime: '2025-01-01T00:00:00Z',
    };
    const result = R2EventNotificationSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('validates a CopyObject event with copySource', () => {
    const event = {
      account: 'abc123',
      action: 'CopyObject',
      bucket: 'superbenefit-knowledge',
      object: { key: 'content/pattern/copy.json', size: 512, eTag: '"def"' },
      eventTime: '2025-01-01T00:00:00Z',
      copySource: { bucket: 'superbenefit-knowledge', object: 'content/pattern/original.json' },
    };
    const result = R2EventNotificationSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('rejects invalid action', () => {
    const event = {
      account: 'abc123',
      action: 'object-create',
      bucket: 'superbenefit-knowledge',
      object: { key: 'content/test.json', size: 1024, eTag: '"abc"' },
      eventTime: '2025-01-01T00:00:00Z',
    };
    const result = R2EventNotificationSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const event = { account: 'abc123' };
    const result = R2EventNotificationSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it('rejects missing object key', () => {
    const event = {
      account: 'abc123',
      action: 'PutObject',
      bucket: 'superbenefit-knowledge',
      object: {},
      eventTime: '2025-01-01T00:00:00Z',
    };
    const result = R2EventNotificationSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe('handleVectorizeQueue message processing', () => {
  it('acks malformed messages without retrying', async () => {
    const { handleVectorizeQueue } = await import('./vectorize');

    const ackFn = vi.fn();
    const batch = {
      messages: [
        {
          id: 'msg-1',
          body: { invalid: 'not-a-valid-event' },
          ack: ackFn,
          retry: vi.fn(),
          timestamp: new Date(),
          attempts: 1,
        },
      ],
      queue: 'test-queue',
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    } as unknown as MessageBatch<unknown>;

    const env = {
      KNOWLEDGE: {} as R2Bucket,
      VECTORIZE: {} as VectorizeIndex,
      AI: {} as Ai,
    };

    await handleVectorizeQueue(batch, env);
    expect(ackFn).toHaveBeenCalled();
  });

  it('acks messages for non-content prefix keys', async () => {
    const { handleVectorizeQueue } = await import('./vectorize');

    const ackFn = vi.fn();
    const batch = {
      messages: [
        {
          id: 'msg-2',
          body: {
            account: 'abc',
            action: 'PutObject',
            bucket: 'test',
            object: { key: 'other/prefix/file.json', size: 100, eTag: '"x"' },
            eventTime: '2025-01-01T00:00:00Z',
          },
          ack: ackFn,
          retry: vi.fn(),
          timestamp: new Date(),
          attempts: 1,
        },
      ],
      queue: 'test-queue',
      ackAll: vi.fn(),
      retryAll: vi.fn(),
    } as unknown as MessageBatch<unknown>;

    const env = {
      KNOWLEDGE: {} as R2Bucket,
      VECTORIZE: {} as VectorizeIndex,
      AI: {} as Ai,
    };

    await handleVectorizeQueue(batch, env);
    expect(ackFn).toHaveBeenCalled();
  });
});
