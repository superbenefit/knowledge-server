/**
 * Porch access control framework types.
 *
 * Phase 1: Only 'open' tier active — no authentication.
 * Phase 2: + 'public' tier via Cloudflare Access for SaaS.
 * Phase 3: + 'members' tier via Hats Protocol / token gate.
 *
 * See spec.md §2 for full access control specification.
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

// Porch roles mapping (Phase 3: Hats Protocol roles)
export type PorchRoles = {
  [key: string]: unknown;
} | null;

// Resolved access context for a request
export interface AuthContext {
  identity: Identity | null;
  tier: AccessTier;
  address: `0x${string}` | null;
  roles: PorchRoles | null;
}

export const AuthContextSchema = z
  .object({
    identity: IdentitySchema.nullable(),
    tier: AccessTierSchema,
    address: z.string().nullable(),
    roles: z.unknown().nullable(),
  })
  .openapi('AuthContext');
