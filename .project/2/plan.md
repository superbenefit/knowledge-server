# Package 1: Auth Module (SIWE, Hats, ENS)

**Issue:** #2
**Branch:** `claude/auth-module-siwe-hats-VicIu`
**Dependencies:** Package 0 (Schemas) — completed

## Scope

Create `src/auth/` with three modules:

1. **siwe-handler.ts** — SIWE verification using `viem/siwe`
   - `createNonce(env)` — generate nonce, store in KV with 5-min TTL
   - `validateNonce(nonce, env)` — single-use validation (delete after use)
   - `verifySIWE(message, signature, env)` — verify with EIP-1271 support

2. **hats.ts** — Hats Protocol role checking on Optimism
   - `checkHatsRoles(address, env)` — check contributor/member hats
   - Uses `@hatsprotocol/sdk-v1-core` for `treeIdToHatId`
   - Caches results in `ROLE_CACHE` (5-min TTL)

3. **ens.ts** — ENS resolution via mainnet RPC
   - `resolveENS(address, env)` — resolve name + avatar
   - Caches results in `ENS_CACHE` (1-hour TTL)

4. **index.ts** — barrel exports

## Key Constraints

- Use `viem/siwe`, NOT standalone `siwe` package (Buffer issues in edge)
- Hats Protocol: Optimism chain 10, contract `0x3bc1A...`, tree 30
- Contributor hat path: [3, 1], Member hat path: [3, 5]
- All functions accept `env: Env` for Cloudflare bindings access

## References

- spec.md sections 2.1-2.7
- plan.md Package 1 section
- src/types/auth.ts — AccessTier, HatsRole, HATS_CONFIG
