import { describe, it, expect } from 'vitest';
import { api } from './routes';

describe('GET /docs', () => {
  it('returns HTML with Scalar API reference', async () => {
    const res = await api.request('/docs');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<!doctype html>');
    expect(text).toContain('scalar');
  });
});

describe('GET /openapi.json', () => {
  it('returns OpenAPI 3.1 spec', async () => {
    const res = await api.request('/openapi.json');
    expect(res.status).toBe(200);
    const json = (await res.json()) as { openapi: string; info: { title: string } };
    expect(json.openapi).toBe('3.1.0');
    expect(json.info.title).toBe('SuperBenefit Knowledge API');
  });
});
