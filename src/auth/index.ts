// Porch access control framework (Phase 1: Open tier only)
export { resolveAuthContext } from './resolve';
export { checkTierAccess } from './check';

// SIWE verification (dormant — Phase 3)
export {
  createNonce,
  validateNonce,
  verifySIWE,
  SiweError,
} from './siwe-handler';
export type { SiweVerificationResult } from './siwe-handler';

// Hats Protocol role checking (dormant — Phase 3)
export { checkHatsRoles } from './hats';

// ENS resolution (dormant — Phase 3)
export { resolveENS } from './ens';
export type { EnsProfile } from './ens';
