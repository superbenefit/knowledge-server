/**
 * SIWE (Sign-In with Ethereum) verification using viem/siwe.
 *
 * Uses viem/siwe instead of the standalone `siwe` package to avoid
 * Buffer API issues in Cloudflare Workers edge runtime.
 *
 * Nonces are stored in KV with a 5-minute TTL and are single-use.
 */

import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import {
  generateSiweNonce,
  parseSiweMessage,
  verifySiweMessage,
} from 'viem/siwe';

/** Result of a successful SIWE verification. */
export interface SiweVerificationResult {
  address: `0x${string}`;
  chainId: number;
  domain: string;
}

const NONCE_TTL_SECONDS = 300; // 5 minutes

/**
 * Generate a cryptographically random SIWE nonce and store it in KV.
 * The nonce expires after 5 minutes.
 */
export async function createNonce(env: Env): Promise<string> {
  const nonce = generateSiweNonce();
  await env.NONCE_KV.put(nonce, 'pending', {
    expirationTtl: NONCE_TTL_SECONDS,
  });
  return nonce;
}

/**
 * Validate and consume a nonce. Returns true if the nonce was valid.
 * Nonces are single-use — deleted immediately after validation.
 */
export async function validateNonce(
  nonce: string,
  env: Env
): Promise<boolean> {
  const value = await env.NONCE_KV.get(nonce);
  if (!value) return false;
  await env.NONCE_KV.delete(nonce); // Single-use
  return true;
}

/**
 * Build a viem PublicClient for Ethereum mainnet.
 * Used for SIWE verification (EIP-1271 smart wallet support).
 */
function getMainnetClient(env: Env) {
  return createPublicClient({
    chain: mainnet,
    transport: http(env.MAINNET_RPC_URL),
  });
}

/**
 * Verify a SIWE message and signature.
 *
 * - Validates the nonce (single-use, deleted on success)
 * - Verifies the signature with `blockTag: 'safe'` for EIP-1271 smart contract wallet support
 * - Returns the verified address and chain ID
 *
 * Throws on invalid nonce or signature.
 */
export async function verifySIWE(
  message: string,
  signature: `0x${string}`,
  env: Env
): Promise<SiweVerificationResult> {
  const parsed = parseSiweMessage(message);

  if (!parsed.nonce) {
    throw new SiweError('MISSING_NONCE', 'SIWE message is missing a nonce');
  }

  // Validate and consume nonce
  const nonceValid = await validateNonce(parsed.nonce, env);
  if (!nonceValid) {
    throw new SiweError('INVALID_NONCE', 'Nonce is invalid or expired');
  }

  // Verify signature (with EIP-1271 support via blockTag: 'safe')
  const client = getMainnetClient(env);
  const valid = await verifySiweMessage(client, {
    message,
    signature,
    blockTag: 'safe',
  });

  if (!valid) {
    throw new SiweError('INVALID_SIGNATURE', 'SIWE signature verification failed');
  }

  return {
    address: parsed.address!,
    chainId: parsed.chainId ?? 1,
    domain: parsed.domain ?? '',
  };
}

/** Structured error for SIWE verification failures. */
export class SiweError extends Error {
  constructor(
    public readonly code:
      | 'MISSING_NONCE'
      | 'INVALID_NONCE'
      | 'INVALID_SIGNATURE',
    message: string
  ) {
    super(message);
    this.name = 'SiweError';
  }
}
