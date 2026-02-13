import { describe, it, expect } from 'vitest';
import { isExcluded, verifyWebhookSignature } from './github';

describe('isExcluded', () => {
  it('excludes files in tools/ directory', () => {
    expect(isExcluded('tools/something.md')).toBe(true);
  });

  it('excludes files in templates/ directory', () => {
    expect(isExcluded('templates/template.md')).toBe(true);
  });

  it('excludes files in .obsidian/ directory', () => {
    expect(isExcluded('.obsidian/config.md')).toBe(true);
  });

  it('excludes files in .github/ directory', () => {
    expect(isExcluded('.github/workflows/ci.md')).toBe(true);
  });

  it('excludes README.md at any depth', () => {
    expect(isExcluded('some/path/README.md')).toBe(true);
  });

  it('excludes LICENSE.md', () => {
    expect(isExcluded('LICENSE.md')).toBe(true);
  });

  it('excludes CONTRIBUTING.md', () => {
    expect(isExcluded('CONTRIBUTING.md')).toBe(true);
  });

  it('allows regular content files', () => {
    expect(isExcluded('data/concepts/dao.md')).toBe(false);
  });

  it('allows files in docs directory', () => {
    expect(isExcluded('docs/guide.md')).toBe(false);
  });

  it('allows nested content files', () => {
    expect(isExcluded('data/resources/patterns/cell-governance.md')).toBe(false);
  });
});

describe('verifyWebhookSignature', () => {
  const secret = 'test-secret-key';

  it('returns false for null signature header', async () => {
    expect(await verifyWebhookSignature('body', null, secret)).toBe(false);
  });

  it('returns false for invalid format (no sha256= prefix)', async () => {
    expect(await verifyWebhookSignature('body', 'invalid', secret)).toBe(false);
  });

  it('returns false for wrong algorithm prefix', async () => {
    expect(await verifyWebhookSignature('body', 'sha1=abc123', secret)).toBe(false);
  });

  it('verifies a valid signature', async () => {
    // Generate a valid signature
    const body = '{"action": "push"}';
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const result = await verifyWebhookSignature(body, `sha256=${hex}`, secret);
    expect(result).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const body = '{"action": "push"}';
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Verify with different body
    const result = await verifyWebhookSignature('tampered body', `sha256=${hex}`, secret);
    expect(result).toBe(false);
  });
});
