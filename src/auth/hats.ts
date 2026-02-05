/**
 * Hats Protocol role checking on Optimism (chain 10).
 *
 * Checks whether an address wears the Contributor or Member hat
 * in SuperBenefit's Hats tree (tree 30) and returns the corresponding
 * access tier.
 *
 * Results are cached in ROLE_CACHE KV with a 5-minute TTL.
 */

import { createPublicClient, http } from 'viem';
import { optimism } from 'viem/chains';
import {
  HATS_V1,
  HATS_ABI,
  treeIdToTopHatId,
} from '@hatsprotocol/sdk-v1-core';
import type { AccessTier, HatsRole } from '../types/auth';
import { HATS_CONFIG } from '../types/auth';

/**
 * Compute a hat ID from tree ID and level path.
 *
 * Hats IDs are uint256 values:
 * - Top 32 bits: tree ID
 * - Each subsequent 16-bit segment: level index
 *
 * Example: tree 30, path [3, 1] => hat ID "30.3.1"
 */
function hatIdFromPath(treeId: number, path: readonly number[]): bigint {
  let hatId = treeIdToTopHatId(treeId);
  for (let i = 0; i < path.length; i++) {
    // Each level occupies 16 bits, starting at bit 208 (224 - 16) and descending
    hatId += BigInt(path[i]) << BigInt(208 - i * 16);
  }
  return hatId;
}

/** Pre-computed hat IDs for SuperBenefit roles. */
const HAT_IDS = {
  contributor: hatIdFromPath(
    HATS_CONFIG.treeId,
    HATS_CONFIG.paths.contributor
  ),
  member: hatIdFromPath(HATS_CONFIG.treeId, HATS_CONFIG.paths.member),
} as const;

const ROLE_CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Build a viem PublicClient for Optimism.
 */
function getOptimismClient(env: Env) {
  return createPublicClient({
    chain: optimism,
    transport: http(env.OPTIMISM_RPC_URL),
  });
}

/**
 * Check whether an address wears the Contributor and/or Member hat.
 *
 * Returns cached results when available (5-minute TTL).
 * On cache miss, queries the Hats v1 contract on Optimism.
 */
export async function checkHatsRoles(
  address: `0x${string}`,
  env: Env
): Promise<HatsRole> {
  // Check cache
  const cacheKey = `roles:${address.toLowerCase()}`;
  const cached = await env.ROLE_CACHE.get(cacheKey, 'json');
  if (cached) return cached as HatsRole;

  const client = getOptimismClient(env);

  const [isContributor, isMember] = await Promise.all([
    client.readContract({
      address: HATS_V1,
      abi: HATS_ABI,
      functionName: 'isWearerOfHat',
      args: [address, HAT_IDS.contributor],
    }),
    client.readContract({
      address: HATS_V1,
      abi: HATS_ABI,
      functionName: 'isWearerOfHat',
      args: [address, HAT_IDS.member],
    }),
  ]);

  const tier: AccessTier = isContributor
    ? 'vibecoder'
    : isMember
      ? 'member'
      : 'public';

  const result: HatsRole = { isContributor, isMember, tier };

  // Cache result
  await env.ROLE_CACHE.put(cacheKey, JSON.stringify(result), {
    expirationTtl: ROLE_CACHE_TTL_SECONDS,
  });

  return result;
}
