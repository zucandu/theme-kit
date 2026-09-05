/**
 * Installs the bare globals the platform's page shell provides, as a SIDE
 * EFFECT at module evaluation.
 *
 * 🚨 This must be the first import in main.js, and it must stay a bare
 * side-effect import. ES imports are hoisted and evaluated before any statement
 * in the importing module runs, so installing these from main.js's body would
 * put them in place AFTER every other module had already been evaluated —
 * including any that reads them at module scope.
 *
 * Two globals, both of which theme code uses without importing anything:
 *
 *  - `zucConfig`  — store configuration, inlined into the HTML by the platform.
 *  - `axios`      — the platform's bootstrap does `window.axios = axios`, and
 *                   theme files and stores call the bare name. Without it the
 *                   first page throws `axios is not defined` from onMounted and
 *                   renders empty.
 */
import { installZucConfig } from './zucConfig.js';
import { createOfflineHttp } from '../shim/services/offlineHttp.js';
import kitConfig from 'virtual:zuc-theme-config';

installZucConfig(kitConfig.zucConfig);

window.axios = createOfflineHttp();
