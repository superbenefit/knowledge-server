/**
 * ENS resolution via Ethereum mainnet RPC.
 *
 * Resolves an Ethereum address to its ENS name and avatar.
 * Results are cached in ENS_CACHE KV with a 1-hour TTL.
 */

import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';

/** ENS resolution result. */
export interface EnsProfile {
  name: string | null;
  avatar: string | null;
}

const ENS_CACHE_TTL_SECONDS = 3600; // 1 hour

/**
 * Build a viem PublicClient for Ethereum mainnet.
 */
function getMainnetClient(env: Env) {
  return createPublicClient({
    chain: mainnet,
    transport: http(env.MAINNET_RPC_URL),
  });
}

/**
 * Resolve an Ethereum address to its ENS name and avatar.
 *
 * Returns cached results when available (1-hour TTL).
 * On cache miss, performs reverse resolution via mainnet RPC.
 */
export async function resolveENS(
  address: `0x${string}`,
  env: Env
): Promise<EnsProfile> {
  // Check cache
  const cacheKey = `ens:${address.toLowerCase()}`;
  const cached = await env.ENS_CACHE.get(cacheKey, 'json');
  if (cached) return cached as EnsProfile;

  const client = getMainnetClient(env);

  // Reverse resolve: address → ENS name
  const name = await client.getEnsName({ address });

  let avatar: string | null = null;
  if (name) {
    // Forward resolve avatar text record
    avatar = await client.getEnsAvatar({ name: normalize(name) });
  }

  const result: EnsProfile = { name, avatar };

  // Cache result (even null results to avoid repeated lookups)
  await env.ENS_CACHE.put(cacheKey, JSON.stringify(result), {
    expirationTtl: ENS_CACHE_TTL_SECONDS,
  });

  return result;
}
