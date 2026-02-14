import { describe, it, expect } from 'vitest';
import { hashQuery } from './rerank';

// sigmoid is not exported, but we can test it indirectly through its properties
// For now, test the exported pure function: hashQuery

describe('hashQuery', () => {
  it('produces a 16-character hex string', async () => {
    const hash = await hashQuery('test query', ['id1', 'id2']);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('produces consistent output for the same input', async () => {
    const hash1 = await hashQuery('governance patterns', ['a', 'b']);
    const hash2 = await hashQuery('governance patterns', ['a', 'b']);
    expect(hash1).toBe(hash2);
  });

  it('produces different output for different queries', async () => {
    const hash1 = await hashQuery('query one', ['id1']);
    const hash2 = await hashQuery('query two', ['id1']);
    expect(hash1).not.toBe(hash2);
  });

  it('produces different output for different IDs', async () => {
    const hash1 = await hashQuery('same query', ['id1', 'id2']);
    const hash2 = await hashQuery('same query', ['id3', 'id4']);
    expect(hash1).not.toBe(hash2);
  });

  it('is order-independent for IDs (sorts before hashing)', async () => {
    const hash1 = await hashQuery('query', ['b', 'a']);
    const hash2 = await hashQuery('query', ['a', 'b']);
    expect(hash1).toBe(hash2);
  });
});
