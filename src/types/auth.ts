/**
 * Porch access control framework types.
 *
 * Phase 1: Only 'open' tier active
 * Phase 2: + 'public' tier via Access for SaaS
 * Phase 3: + 'members' tier via Hats/token gate
 *
 * See porch-spec.md v0.14 for full specification.
 */

import { z } from '@hono/zod-openapi';

// Access tiers ordered by privilege level
export type AccessTier = 'open' | 'public' | 'members';

export const AccessTierSchema = z
  .enum(['open', 'public', 'members'])
  .openapi('AccessTier');

export const TIER_LEVEL: Record<AccessTier, number> = {
  open: 0,
  public: 1,
  members: 2,
};

// Authenticated identity. Null for anonymous (Open tier) requests.
export interface Identity {
  userId: string;
  name: string | null;
  email: string | null;
  provider: string; // "github" | "siwe"
}

export const IdentitySchema = z
  .object({
    userId: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    provider: z.string(),
  })
  .openapi('Identity');

// Hats Protocol role information (dormant until Phase 3)
export interface HatsRole {
  hats: bigint[];
  isMember: boolean;
  isContributor: boolean;
}

export const HatsRoleSchema = z
  .object({
    hats: z.array(z.bigint()),
    isMember: z.boolean(),
    isContributor: z.boolean(),
  })
  .openapi('HatsRole');

// Resolved access context for a request
export interface AuthContext {
  identity: Identity | null;
  tier: AccessTier;
  address: `0x${string}` | null;
  roles: HatsRole | null;
}

export const AuthContextSchema = z
  .object({
    identity: IdentitySchema.nullable(),
    tier: AccessTierSchema,
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).nullable(),
    roles: HatsRoleSchema.nullable(),
  })
  .openapi('AuthContext');

// Hats Protocol constants (dormant until Phase 3)
export const HATS_CONFIG = {
  chain: 10, // Optimism
  chainId: 10,
  contract: '0x3bc1A0Ad72417f2d411118085256fC53CBdDd137' as const,
  treeId: 30,
  paths: {
    contributor: [3, 1] as const,
    member: [3, 5] as const,
  },
} as const;
