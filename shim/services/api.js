/**
 * Offline stand-in for the platform's axios instances.
 *
 * ONLY `storefrontApi` is exported. The real module also exports `adminApi`,
 * and leaving it out is deliberate: this kit is storefront-only, so a theme file
 * reaching for an admin instance should fail at import time rather than quietly
 * work here and hit a 403 on a live store.
 */
import { createOfflineHttp } from './offlineHttp.js';

export const storefrontApi = createOfflineHttp();

export default { storefrontApi };
