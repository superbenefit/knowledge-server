/**
 * Auth context resolution for the porch access control framework.
 *
 * Phase 1: Always returns open tier (no authentication).
 *
 * When Phase 2/3 are implemented, this function is the ONLY place
 * tier resolution logic lives. Tools never resolve tiers themselves.
 * See spec.md §2 for the full access control design.
 */

import type { AuthContext } from '../types/auth';

/**
 * Resolve access context from the current request.
 * Phase 1: Always returns open tier — no authentication.
 */
export async function resolveAuthContext(_env: Env): Promise<AuthContext> {
  return { identity: null, tier: 'open' };
}
