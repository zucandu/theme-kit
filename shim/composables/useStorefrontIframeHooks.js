/**
 * Storefront app hooks — the iframe slots installed apps render into.
 *
 * Always empty, and that is the correct default rather than a shortcut: hooks
 * exist only where a merchant has installed an app, so a theme MUST lay out
 * correctly with none present. A theme that only looks right once a hook fills
 * a gap is broken on every store that has not installed that app.
 *
 * To preview the filled state, push a row into `hooks` from the browser console.
 */
import { ref } from 'vue';

export function useStorefrontIframeHooks() {
    const hooks = ref([]);
    const fetchHooks = async () => hooks.value;
    return { hooks, fetchHooks };
}
