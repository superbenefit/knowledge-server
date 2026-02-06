/**
 * Auth context resolution for the porch access control framework.
 *
 * Phase 1: Always returns open tier (no authentication).
 * Phase 2: Extracts identity from getMcpAuthContext() (populated by
 *          Access JWT injection via createMcpHandler's authContext option),
 *          returns 'public' after sybil/agreement checks.
 * Phase 3: Checks Hats/tokens/org membership, returns 'members' if authorized.
 *
 * This function is the ONLY place tier resolution logic lives.
 * Tools never resolve tiers themselves.
 */

import type { AuthContext } from '../types/auth';

/**
 * Resolve access context from the current request.
 *
 * @param _env - Environment bindings (unused in Phase 1)
 * @returns AuthContext with tier set to 'open' in Phase 1
 */
export async function resolveAuthContext(_env: Env): Promise<AuthContext> {
  // --- Phase 2: Authentication ---
  // const mcpAuth = getMcpAuthContext();
  // if (!mcpAuth?.props?.sub) {
  //   return { identity: null, tier: 'open', address: null, roles: null };
  // }
  //
  // const identity: Identity = {
  //   userId: mcpAuth.props.sub as string,
  //   name: (mcpAuth.props.name as string) ?? null,
  //   email: (mcpAuth.props.email as string) ?? null,
  //   provider: (mcpAuth.props.provider as string) ?? 'unknown',
  // };
  //
  // // TODO: Sybil check (Human Passport, threshold 25)
  // // TODO: Community agreement acceptance check
  //
  // --- Phase 3: Authorization ---
  // const address = await _env.IDENTITY_MAP.get(identity.userId);
  // if (address) {
  //   const roles = await checkHatsRoles(address as `0x${string}`, _env);
  //   if (roles.isMember || roles.isContributor) {
  //     return { identity, tier: 'members', address: address as `0x${string}`, roles };
  //   }
  // }
  //
  // // Fallback: check GitHub org membership
  // if (identity.provider === 'github') {
  //   const isSBMember = await checkGitHubOrgMembership(identity.userId, _env);
  //   if (isSBMember) {
  //     return { identity, tier: 'members', address: null, roles: null };
  //   }
  // }
  //
  // return { identity, tier: 'public', address: null, roles: null };

  // Phase 1: Open tier only — no authentication
  return { identity: null, tier: 'open', address: null, roles: null };
}
