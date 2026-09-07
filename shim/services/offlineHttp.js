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

/**
 * The one place the rule above is wrong: endpoints where an empty answer is a
 * WRONG answer rather than a missing one.
 *
 * 🚨 `POST /booking/quote` is the whole list, and it earns its place. The picker
 * reads `options_sum` off the response and, once it has one, that figure REPLACES
 * the surcharge it worked out in the browser (`serverPriceDelta !== null` wins
 * over `totalPriceDelta`). Answering `{}` therefore reads as "the server says
 * these options cost nothing", and picking "Deluxe Room — $40.00" would move the
 * displayed price by zero — a price the kit had, and threw away.
 *
 * Failing instead is what the component is already written for: it keeps the
 * last-known-good delta, which offline is the correct client-side sum. The call
 * sits inside a try/catch, so nothing else is aborted by this.
 */
const NO_HONEST_EMPTY_ANSWER = [
    { method: 'POST', pattern: /\/booking\/quote$/, why: 'no pricing engine offline — the picker keeps its own option sum' },
];

const seen = new Set();

function offline(method, url) {
    const refused = NO_HONEST_EMPTY_ANSWER
        .find((rule) => rule.method === method && rule.pattern.test(String(url).split('?')[0]));

    if (refused) {
        const key = `${method} ${url}`;
        if (!seen.has(key)) {
            seen.add(key);
            console.info(
                `%c[theme-kit] offline%c ${key} -> refused (${refused.why})`,
                'color:#8a8274',
                'color:inherit'
            );
        }
        return Promise.reject(new Error(`[theme-kit] ${key}: ${refused.why}`));
    }

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

    // A theme importing `axios` gets this object, so the module-level helpers it
    // reaches for have to be here too. Nothing offline is ever cancelled, so a
    // refusal is reported as the real failure it is rather than swallowed as one.
    client.isCancel = () => false;
    client.isAxiosError = (value) => value instanceof Error;
    client.CancelToken = { source: () => ({ token: null, cancel: () => {} }) };

    return client;
}
