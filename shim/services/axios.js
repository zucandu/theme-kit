/**
 * `axios`, for a theme that imports the module directly.
 *
 * Most platform HTTP reaches a theme through `@/services/api` or the global
 * `window.axios`, and both were already offline. A component that does
 * `import axios from 'axios'` bypassed both and went to the real network — which
 * is how the booking picker's quote request left a 404 in the console on every
 * date the developer clicked, on a kit whose first console line promises "no
 * store, no network".
 *
 * Aliased in vite.config.js AHEAD of the node_modules dependency aliases, so the
 * bare specifier resolves here instead. Nothing in the kit needs the real axios.
 */
import { createOfflineHttp } from './offlineHttp.js';

const axios = createOfflineHttp();

export default axios;
export const { get, post, put, patch, delete: del, head, request, isCancel, isAxiosError, CancelToken } = axios;
