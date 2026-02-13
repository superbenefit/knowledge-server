import { describe, it, expect } from 'vitest';
import { parseMarkdown, shouldSync, resolveContentType, validateFrontmatter } from './parser';

describe('parseMarkdown', () => {
  it('parses valid YAML frontmatter and body', () => {
    const raw = `---
title: Test Document
publish: true
---
Body content here.`;
    const result = parseMarkdown(raw);
    expect(result.frontmatter.title).toBe('Test Document');
    expect(result.frontmatter.publish).toBe(true);
    expect(result.body).toBe('Body content here.');
    expect(result.parseError).toBeUndefined();
  });

  it('returns empty frontmatter and full body when no frontmatter delimiters', () => {
    const raw = 'Just plain markdown content.';
    const result = parseMarkdown(raw);
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe('Just plain markdown content.');
    expect(result.parseError).toBeUndefined();
  });

  it('sets parseError on malformed YAML instead of silently returning empty', () => {
    const raw = `---
title: Bad YAML
  invalid: [unclosed
---
Body here.`;
    const result = parseMarkdown(raw);
    expect(result.parseError).toBeDefined();
    expect(typeof result.parseError).toBe('string');
    expect(result.frontmatter).toEqual({});
  });

  it('sets parseError on oversized YAML frontmatter', () => {
    const bigYaml = 'key: ' + 'x'.repeat(10001);
    const raw = `---\n${bigYaml}\n---\nBody.`;
    const result = parseMarkdown(raw);
    expect(result.parseError).toBeDefined();
    expect(result.parseError).toContain('too large');
  });

  it('handles empty frontmatter block', () => {
    // Empty frontmatter (nothing between delimiters) doesn't match the regex,
    // so the whole raw string becomes the body.
    const raw = `---
---
Body only.`;
    const result = parseMarkdown(raw);
    expect(result.frontmatter).toEqual({});
    expect(result.body).toBe('---\n---\nBody only.');
    expect(result.parseError).toBeUndefined();
  });

  it('handles frontmatter with complex nested objects', () => {
    const raw = `---
title: Nested
metadata:
  key: value
  list:
    - one
    - two
publish: true
---
Content.`;
    const result = parseMarkdown(raw);
    expect(result.frontmatter.title).toBe('Nested');
    expect((result.frontmatter.metadata as any).key).toBe('value');
    expect(result.parseError).toBeUndefined();
  });

  it('handles frontmatter that parses to non-object (e.g. string)', () => {
    const raw = `---
just a string
---
Body.`;
    const result = parseMarkdown(raw);
    // When YAML parses to a non-object, it should be reset to {}
    expect(result.frontmatter).toEqual({});
    expect(result.parseError).toBeUndefined();
  });

  it('handles frontmatter that parses to an array', () => {
    const raw = `---
- item1
- item2
---
Body.`;
    const result = parseMarkdown(raw);
    expect(result.frontmatter).toEqual({});
    expect(result.parseError).toBeUndefined();
  });
});

describe('shouldSync', () => {
  it('returns true when publish is true and draft is not true', () => {
    expect(shouldSync({ publish: true })).toBe(true);
  });

  it('returns false when publish is false', () => {
    expect(shouldSync({ publish: false })).toBe(false);
  });

  it('returns false when draft is true', () => {
    expect(shouldSync({ publish: true, draft: true })).toBe(false);
  });

  it('returns false for empty frontmatter', () => {
    expect(shouldSync({})).toBe(false);
  });

  it('returns true when publish is true and draft is explicitly false', () => {
    expect(shouldSync({ publish: true, draft: false })).toBe(true);
  });
});

describe('resolveContentType', () => {
  it('uses frontmatter type when valid', () => {
    expect(resolveContentType({ type: 'pattern' }, 'some/path.md')).toBe('pattern');
  });

  it('falls back to path inference when type is missing', () => {
    expect(resolveContentType({}, 'data/concepts/some-tag.md')).toBe('tag');
  });

  it('falls back to path inference when type is invalid', () => {
    expect(resolveContentType({ type: 'notavalidtype' }, 'data/concepts/term.md')).toBe('tag');
  });

  it('returns file for unknown paths with no frontmatter type', () => {
    expect(resolveContentType({}, 'unknown/path.md')).toBe('file');
  });
});

describe('validateFrontmatter', () => {
  it('returns validated data for valid frontmatter', () => {
    const result = validateFrontmatter({
      title: 'Test',
      date: '2025-01-01',
      publish: true,
    });
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Test');
  });

  it('returns null for invalid frontmatter (missing required fields)', () => {
    const result = validateFrontmatter({});
    expect(result).toBeNull();
  });
});
