import { describe, it, expect } from 'vitest';
import { resolveAuthContext } from './resolve';

describe('resolveAuthContext', () => {
  // Phase 1: always returns open tier with no identity
  const mockEnv = {} as Env;

  it('returns open tier', async () => {
    const ctx = await resolveAuthContext(mockEnv);
    expect(ctx.tier).toBe('open');
  });

  it('returns null identity (no authentication in Phase 1)', async () => {
    const ctx = await resolveAuthContext(mockEnv);
    expect(ctx.identity).toBeNull();
  });

  it('returns null address', async () => {
    const ctx = await resolveAuthContext(mockEnv);
    expect(ctx.address).toBeNull();
  });

  it('returns null roles', async () => {
    const ctx = await resolveAuthContext(mockEnv);
    expect(ctx.roles).toBeNull();
  });

  it('returns the complete expected shape', async () => {
    const ctx = await resolveAuthContext(mockEnv);
    expect(ctx).toEqual({
      identity: null,
      tier: 'open',
      address: null,
      roles: null,
    });
  });
});
