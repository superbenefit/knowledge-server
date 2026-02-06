/**
 * Tier access checking for the porch access control framework.
 *
 * Tools declare their required tier. This function enforces it.
 * The tool never needs to know how tiers are resolved.
 */

import type { AccessTier, AuthContext } from '../types/auth';
import { TIER_LEVEL } from '../types/auth';

type TierAccessResult =
  | { allowed: true; authContext: AuthContext }
  | { allowed: false; requiredTier: AccessTier; currentTier: AccessTier };

/**
 * Check whether an auth context meets the required tier.
 *
 * @param requiredTier - The minimum tier required for access
 * @param authContext - The resolved auth context from resolveAuthContext()
 * @returns Result indicating access allowed or denied with tier information
 */
export function checkTierAccess(
  requiredTier: AccessTier,
  authContext: AuthContext,
): TierAccessResult {
  if (TIER_LEVEL[authContext.tier] >= TIER_LEVEL[requiredTier]) {
    return { allowed: true, authContext };
  }
  return { allowed: false, requiredTier, currentTier: authContext.tier };
}
