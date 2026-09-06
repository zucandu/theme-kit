/**
 * Dynamic script/CSS loader — how a theme pulls in a vendor SDK at runtime.
 *
 * Neither call actually loads anything here, and that is the only honest answer
 * the kit can give. A vendor SDK is fetched from the vendor's own servers, which
 * is precisely what this kit does not do; and on a real store the URL first has
 * to clear a host allowlist that depends on which payment and third-party
 * modules that store has enabled. The kit has no store, so it has no list, so it
 * cannot judge a URL either way.
 *
 * 🚨 Both RESOLVE rather than reject. Theme code awaits `loadScript()` inside
 * `onMounted` and builds the rest of the widget after it, so rejecting would
 * blank the component a developer is trying to look at — the same reasoning as
 * `offlineHttp`. The trade is that a silently-resolved load looks like a
 * successful one, so each URL is logged instead: an SDK-backed widget that stays
 * empty next to a `[theme-kit] offline` line is this file, not your markup.
 *
 * What that means for layout: design the un-loaded state too. On a live store
 * the same widget renders empty whenever the merchant has not enabled the module
 * that puts the vendor's host on the allowlist.
 */
const seen = new Set();

function offline(kind, url) {
    const key = `${kind} ${url}`;
    if (seen.has(key)) return;
    seen.add(key);
    console.info(`%c[theme-kit] offline%c ${key} -> not loaded`, 'color:#8a8274', 'color:inherit');
}

export function useLoader() {
    const loadScript = (src) => {
        offline('loadScript', src);
        return Promise.resolve();
    };

    const loadCSS = (href) => {
        offline('loadCSS', href);
    };

    return { loadScript, loadCSS };
}
