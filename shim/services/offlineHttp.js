/**
 * The single offline HTTP responder, shared by `storefrontApi` and the global
 * `axios` the platform installs on `window`.
 *
 * Every verb RESOLVES with an empty payload rather than rejecting. Theme code is
 * full of `await axios.get(...)` inside `onMounted`, and a rejection there aborts
 * the rest of that setup — one unmocked endpoint would blank a page the developer
 * is trying to look at. Resolving empty keeps the page up and puts the missing
 * endpoint in the console, where it can be read and acted on.
 *
 * A GET the kit HAS a fixture for is answered with it rather than with `{}` —
 * see offlineFixtures.js. Not every page reaches the platform through a store,
 * and the two that do not were rendering their empty state forever.
 *
 * Each distinct URL is logged once, saying which of the two it got. A theme that
 * polls would otherwise flood the console and bury the developer's own logging.
 */
import { fixtureFor } from './offlineFixtures.js';

const seen = new Set();

function offline(method, url) {
    // Writes are never answered from a fixture: what a store does with a POST is
    // its decision, and inventing an outcome would show a save that did not
    // happen. Empty is the honest answer there.
    const fixture = method === 'GET' ? fixtureFor(url) : null;

    const key = `${method} ${url}`;
    if (!seen.has(key)) {
        seen.add(key);
        console.info(
            `%c[theme-kit] offline%c ${key} -> ${fixture ? 'fixture' : '{}'}`,
            'color:#8a8274',
            'color:inherit'
        );
    }

    return Promise.resolve({
        data: fixture ?? {},
        status: 200,
        statusText: 'OK (theme-kit offline)',
        headers: {},
        config: {},
    });
}

export function createOfflineHttp() {
    const client = {
        get: (url) => offline('GET', url),
        post: (url) => offline('POST', url),
        put: (url) => offline('PUT', url),
        patch: (url) => offline('PATCH', url),
        delete: (url) => offline('DELETE', url),
        head: (url) => offline('HEAD', url),
        request: (config = {}) => offline((config.method || 'GET').toUpperCase(), config.url ?? ''),
        interceptors: {
            request: { use: () => 0, eject: () => {} },
            response: { use: () => 0, eject: () => {} },
        },
        defaults: { headers: { common: {} }, withCredentials: true },
    };

    client.create = () => createOfflineHttp();
    return client;
}
