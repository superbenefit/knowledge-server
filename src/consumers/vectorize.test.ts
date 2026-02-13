import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

// Test the R2 event notification schema validation directly
const R2EventNotificationSchema = z.object({
  account: z.string(),
  bucket: z.string(),
  object: z.object({
    key: z.string(),
    size: z.number(),
    eTag: z.string(),
  }),
  eventType: z.enum(['object-create', 'object-delete']),
  eventTime: z.string(),
});

describe('R2EventNotification schema', () => {
  it('validates a valid create event', () => {
    const event = {
      account: 'abc123',
      bucket: 'superbenefit-knowledge',
      object: { key: 'content/pattern/test.json', size: 1024, eTag: '"abc"' },
      eventType: 'object-create',
      eventTime: '2025-01-01T00:00:00Z',
    };
    const result = R2EventNotificationSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('validates a valid delete event', () => {
    const event = {
      account: 'abc123',
      bucket: 'superbenefit-knowledge',
      object: { key: 'content/tag/dao.json', size: 512, eTag: '"def"' },
      eventType: 'object-delete',
      eventTime: '2025-01-01T00:00:00Z',
    };
    const result = R2EventNotificationSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('rejects invalid event type', () => {
    const event = {
      account: 'abc123',
      bucket: 'superbenefit-knowledge',
      object: { key: 'content/test.json', size: 1024, eTag: '"abc"' },
      eventType: 'object-update',
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

  it('rejects malformed object', () => {
    const event = {
      account: 'abc123',
      bucket: 'superbenefit-knowledge',
      object: { key: 'test.json' }, // missing size and eTag
      eventType: 'object-create',
      eventTime: '2025-01-01T00:00:00Z',
    };
    const result = R2EventNotificationSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

describe('handleVectorizeQueue message processing', () => {
  it('acks malformed messages without retrying', async () => {
    // Import the actual handler
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
            bucket: 'test',
            object: { key: 'other/prefix/file.json', size: 100, eTag: '"x"' },
            eventType: 'object-create',
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
