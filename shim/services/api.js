/**
 * Offline stand-in for the platform's axios instances.
 *
 * ONLY `storefrontApi` is exported. The real module also exports `adminApi` and
 * three refs the admin interceptor sets from rebuild headers, and leaving them
 * out is deliberate: this kit is storefront-only, so a theme file reaching for
 * an admin instance should fail at import time rather than quietly work here and
 * hit a 403 on a live store. That direction is safe — it fails HERE and works
 * there.
 *
 * 🚨 There is deliberately NO default export, and there used to be. The platform's
 * api.js has none, so `import api from '@/services/api'` resolved to
 * `{ storefrontApi }` here and to `undefined` on a store — every call on it a
 * TypeError, after upload, with nothing to have caught it.
 */
import { createOfflineHttp } from './offlineHttp.js';

export const storefrontApi = createOfflineHttp();
