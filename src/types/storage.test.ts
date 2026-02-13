import { describe, it, expect } from 'vitest';
import { generateId, toR2Key, extractIdFromKey, truncateForMetadata } from './storage';

describe('generateId', () => {
  it('extracts filename without .md extension', () => {
    expect(generateId('artifacts/patterns/cell-governance.md')).toBe('cell-governance');
  });

  it('handles paths with single segment', () => {
    expect(generateId('simple.md')).toBe('simple');
  });

  it('handles deeply nested paths', () => {
    expect(generateId('a/b/c/d/file.md')).toBe('file');
  });

  it('throws on IDs exceeding 64 bytes', () => {
    const longName = 'a'.repeat(65) + '.md';
    expect(() => generateId(longName)).toThrow('64 byte limit');
  });

  it('accepts IDs at exactly 64 bytes', () => {
    const name = 'a'.repeat(64) + '.md';
    expect(generateId(name)).toBe('a'.repeat(64));
  });
});

describe('toR2Key', () => {
  it('constructs correct R2 key', () => {
    expect(toR2Key('pattern', 'cell-governance')).toBe('content/pattern/cell-governance.json');
  });

  it('rejects path traversal with ..', () => {
    expect(() => toR2Key('pattern', '../secret')).toThrow('Invalid characters');
  });

  it('rejects path traversal with forward slash', () => {
    expect(() => toR2Key('pattern', 'a/b')).toThrow('Invalid characters');
  });

  it('rejects path traversal with backslash', () => {
    expect(() => toR2Key('pattern', 'a\\b')).toThrow('Invalid characters');
  });

  it('handles various content types', () => {
    expect(toR2Key('tag', 'dao')).toBe('content/tag/dao.json');
    expect(toR2Key('article', 'my-article')).toBe('content/article/my-article.json');
  });
});

describe('extractIdFromKey', () => {
  it('extracts ID from R2 key', () => {
    expect(extractIdFromKey('content/pattern/cell-governance.json')).toBe('cell-governance');
  });

  it('handles simple keys', () => {
    expect(extractIdFromKey('content/tag/dao.json')).toBe('dao');
  });
});

describe('truncateForMetadata', () => {
  it('returns short content unchanged', () => {
    const content = 'Short content.';
    expect(truncateForMetadata(content)).toBe(content);
  });

  it('truncates content exceeding 8000 chars', () => {
    const content = 'word '.repeat(2000); // 10000 chars
    const result = truncateForMetadata(content);
    // truncateForMetadata: takes first 8000 chars, finds last space, adds "..."
    expect(result.length).toBeLessThanOrEqual(8003); // up to 8000 + "..."
    expect(result.endsWith('...')).toBe(true);
  });

  it('truncates at word boundary', () => {
    const content = 'a'.repeat(7990) + ' ' + 'b'.repeat(100);
    const result = truncateForMetadata(content);
    expect(result.endsWith('...')).toBe(true);
    // Should not end in a partial word
    expect(result).not.toContain('bbb');
  });
});
