# Package 5: Queue Consumer (Vectorize Indexing)

## Overview

Implement the queue consumer that processes R2 event notifications to keep Vectorize in sync with R2 content storage.

## Architecture

R2 bucket event notifications trigger queue messages. The consumer:
1. Receives batched R2 event notifications
2. Filters for `content/` prefix objects only
3. On `object-create`: fetches R2Document, generates embedding via Workers AI, upserts to Vectorize
4. On `object-delete`: extracts document ID, deletes from Vectorize

## Files

- `src/consumers/vectorize.ts` — Queue consumer handler + updateVectorize/deleteFromVectorize functions

## Key Constraints

- Per-message `msg.ack()`, never `batch.ackAll()`
- Idempotent operations (R2 events have no ordering guarantee)
- Vectorize metadata: 6 indexed + 4 non-indexed fields within 10 KiB limit
- Use `@cf/baai/bge-base-en-v1.5` for embeddings
- Use `truncateForMetadata()` for content field
- Vector ID = `doc.id` (same as R2 key stem)
- `metadata.path` = R2 object key for later retrieval

## Dependencies

- `src/types/storage.ts` — R2Document, VectorizeMetadata, helpers
- `src/types/content.ts` — ContentType
- Worker bindings: KNOWLEDGE (R2), VECTORIZE (VectorizeIndex), AI (Workers AI)
