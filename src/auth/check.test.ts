import { describe, it, expect } from 'vitest';
import { checkTierAccess } from './check';
import type { AccessTier, AuthContext } from './types';

function makeAuthContext(tier: AccessTier): AuthContext {
  return { identity: null, tier, address: null, roles: null };
}

describe('checkTierAccess', () => {
  // All 9 tier combinations (3 required x 3 current)

  describe('required: open', () => {
    it('allows open tier', () => {
      const result = checkTierAccess('open', makeAuthContext('open'));
      expect(result.allowed).toBe(true);
    });

    it('allows public tier (higher than required)', () => {
      const result = checkTierAccess('open', makeAuthContext('public'));
      expect(result.allowed).toBe(true);
    });

    it('allows members tier (higher than required)', () => {
      const result = checkTierAccess('open', makeAuthContext('members'));
      expect(result.allowed).toBe(true);
    });
  });

  describe('required: public', () => {
    it('denies open tier (lower than required)', () => {
      const result = checkTierAccess('public', makeAuthContext('open'));
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.requiredTier).toBe('public');
        expect(result.currentTier).toBe('open');
      }
    });

    it('allows public tier', () => {
      const result = checkTierAccess('public', makeAuthContext('public'));
      expect(result.allowed).toBe(true);
    });

    it('allows members tier (higher than required)', () => {
      const result = checkTierAccess('public', makeAuthContext('members'));
      expect(result.allowed).toBe(true);
    });
  });

  describe('required: members', () => {
    it('denies open tier (lower than required)', () => {
      const result = checkTierAccess('members', makeAuthContext('open'));
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.requiredTier).toBe('members');
        expect(result.currentTier).toBe('open');
      }
    });

    it('denies public tier (lower than required)', () => {
      const result = checkTierAccess('members', makeAuthContext('public'));
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.requiredTier).toBe('members');
        expect(result.currentTier).toBe('public');
      }
    });

    it('allows members tier', () => {
      const result = checkTierAccess('members', makeAuthContext('members'));
      expect(result.allowed).toBe(true);
    });
  });

  describe('access result shape', () => {
    it('includes authContext when allowed', () => {
      const ctx = makeAuthContext('open');
      const result = checkTierAccess('open', ctx);
      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.authContext).toBe(ctx);
      }
    });

    it('includes requiredTier and currentTier when denied', () => {
      const result = checkTierAccess('members', makeAuthContext('open'));
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result).toHaveProperty('requiredTier');
        expect(result).toHaveProperty('currentTier');
      }
    });
  });
});
