import { z } from '@hono/zod-openapi';

// Access tiers (spec section 2.8)
export const AccessTierSchema = z
  .enum(['public', 'member', 'vibecoder'])
  .openapi('AccessTier');

export type AccessTier = z.infer<typeof AccessTierSchema>;

// Hats Protocol role check result (spec section 2.4)
export const HatsRoleSchema = z
  .object({
    isContributor: z.boolean(),
    isMember: z.boolean(),
    tier: AccessTierSchema,
  })
  .openapi('HatsRole');

export type HatsRole = z.infer<typeof HatsRoleSchema>;

// Auth props attached to OAuth token (spec section 2.7)
export const AuthPropsSchema = z
  .object({
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    tier: AccessTierSchema,
    roles: HatsRoleSchema,
    ensName: z.string().nullable().optional(),
    chainId: z.number(),
  })
  .openapi('AuthProps');

export type AuthProps = z.infer<typeof AuthPropsSchema>;

// Hats Protocol constants (spec section 2.4)
export const HATS_CONFIG = {
  chain: 10, // Optimism
  contract: '0x3bc1A0Ad72417f2d411118085256fC53CBdDd137' as const,
  treeId: 30,
  paths: {
    contributor: [3, 1] as const,
    member: [3, 5] as const,
  },
} as const;

// Tools available per tier (spec section 7.2)
export const TIER_TOOLS: Record<AccessTier, readonly string[]> = {
  public: ['search_knowledge', 'define_term', 'search_lexicon', 'list_groups', 'list_releases'],
  member: ['search_knowledge', 'define_term', 'search_lexicon', 'list_groups', 'list_releases', 'get_document', 'search_with_documents', 'save_link'],
  vibecoder: ['search_knowledge', 'define_term', 'search_lexicon', 'list_groups', 'list_releases', 'get_document', 'search_with_documents', 'save_link', 'create_draft'],
} as const;
