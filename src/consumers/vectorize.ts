/**
 * Queue consumer for R2 event notifications → Vectorize indexing.
 *
 * Processes R2 bucket events to keep Vectorize in sync with stored content.
 * Uses per-message ack() — never batch.ackAll().
 */

import { z } from 'zod';
import type { VectorizeMetadata, R2Document } from '../types';
import {
  extractIdFromKey,
  truncateForMetadata,
  toR2Key,
  VECTORIZE_NAMESPACE,
} from '../types/storage';

// ---------------------------------------------------------------------------
// R2 event notification schema (validated before processing)
// ---------------------------------------------------------------------------

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

type R2EventNotification = z.infer<typeof R2EventNotificationSchema>;

// ---------------------------------------------------------------------------
// Dependencies interface (for testability)
// ---------------------------------------------------------------------------

interface ConsumerDeps {
  KNOWLEDGE: R2Bucket;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
}

// ---------------------------------------------------------------------------
// Queue handler
// ---------------------------------------------------------------------------

export async function handleVectorizeQueue(
  batch: MessageBatch<unknown>,
  env: ConsumerDeps,
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      // Security: Validate message schema before processing
      const parseResult = R2EventNotificationSchema.safeParse(msg.body);
      if (!parseResult.success) {
        console.error(`Invalid queue message schema: ${parseResult.error.message}`);
        msg.ack(); // Don't retry malformed messages
        continue;
      }
      const { object, eventType } = parseResult.data;

      // Only process objects under the content/ prefix
      if (!object.key.startsWith('content/')) {
        msg.ack();
        continue;
      }

      if (eventType === 'object-create') {
        const r2Object = await env.KNOWLEDGE.get(object.key);
        if (!r2Object) {
          // Object was already deleted between event and processing — nothing to do
          msg.ack();
          continue;
        }
        const doc: R2Document = await r2Object.json();
        await updateVectorize(doc, env);
      } else if (eventType === 'object-delete') {
        const id = extractIdFromKey(object.key);
        await deleteFromVectorize(id, env);
      }

      msg.ack();
    } catch (err) {
      // Don't ack — message will be retried by the queue
      console.error(
        `Failed to process queue message ${msg.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Vectorize operations
// ---------------------------------------------------------------------------

/**
 * Generate embedding and upsert document into Vectorize.
 * Idempotent: upserting the same ID overwrites the previous vector.
 */
export async function updateVectorize(
  doc: R2Document,
  env: Pick<ConsumerDeps, 'AI' | 'VECTORIZE'>,
): Promise<void> {
  // Build the text to embed: title + description + content body
  const embeddingInput = [doc.metadata.title, doc.metadata.description, doc.content]
    .filter(Boolean)
    .join('\n\n');

  // Generate embedding via Workers AI
  const embeddingResult = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [embeddingInput],
  });

  if (!('data' in embeddingResult) || !embeddingResult.data) {
    throw new Error(`Embedding generation returned no data for document: ${doc.id}`);
  }

  const values = embeddingResult.data[0];
  if (!values) {
    throw new Error(`Embedding generation returned empty vector for document: ${doc.id}`);
  }

  // Build metadata — 6 indexed + 4 non-indexed, within 10 KiB limit
  const metadata: VectorizeMetadata = {
    // Indexed fields (used for filtering in search queries)
    contentType: doc.contentType,
    group: (doc.metadata.group as string) || '',
    tags: Array.isArray(doc.metadata.tags)
      ? (doc.metadata.tags as string[]).join(',')
      : '',
    release: (doc.metadata.release as string) || '',
    status: (doc.metadata.status as string) || '',
    date: doc.metadata.date
      ? new Date(doc.metadata.date as string).getTime()
      : 0,

    // Non-indexed fields (for retrieval and reranking without R2 round-trips)
    path: toR2Key(doc.contentType, doc.id),
    title: (doc.metadata.title as string) || '',
    description: (doc.metadata.description as string) || '',
    content: truncateForMetadata(doc.content),
  };

  // Upsert — idempotent, overwrites any existing vector with same ID
  await env.VECTORIZE.upsert([
    {
      id: doc.id,
      values,
      metadata,
      namespace: VECTORIZE_NAMESPACE,
    },
  ]);
}

/**
 * Delete a document's vector from Vectorize.
 * Idempotent: deleting a non-existent ID is a no-op.
 */
export async function deleteFromVectorize(
  id: string,
  env: Pick<ConsumerDeps, 'VECTORIZE'>,
): Promise<void> {
  await env.VECTORIZE.deleteByIds([id]);
}
