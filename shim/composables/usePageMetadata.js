/**
 * Client-side page metadata, matching what the server renders.
 *
 * 🚨 Every storefront page that set metadata did this:
 *
 *     document.title = translation?.meta_title || zucConfig.store_name;
 *     if (metaDesc) metaDesc.content = translation?.meta_description || '';
 *
 * So a page with no hand-written metadata took the server's fallback — the one
 * that names the page — and replaced it with the bare store name, or with an
 * empty string. `MetaTag.php` can build the best description in the world and
 * the browser blanks it as soon as the API answers. Same shape as 1.212.70,
 * where the server half of group pricing changed nothing on the page.
 *
 * ⚠️ "Just don't overwrite" is NOT the fix. On a client-side route change the
 * document still holds the PREVIOUS page's metadata, so leaving it alone means
 * every SPA navigation describes the page you came from. The fallback chain has
 * to exist on both sides, which is why it is reproduced here rather than
 * deferred to the server.
 *
 * Kept in `resources/js/composables` on purpose: `@` resolves to `resources/js`
 * in vite.config.js AND vite.storefront.config.js, so this file reaches every
 * store's build. Only the call site inside a theme file does not propagate —
 * which reduces the un-propagatable part to one line per page.
 */

/**
 * Collapse rich text into something that belongs in a meta tag.
 * Mirrors \Setting\MetaTag::summarise().
 *
 * @param {string|null|undefined} html
 * @param {number} limit
 * @returns {string}
 */
/**
 * 🚨 Decode entities WITHOUT touching an HTML sink.
 *
 * The first version of this file used the `textarea.innerHTML` trick, which is
 * the standard way to do this and is wrong here: `innerHTML` is a Trusted Types
 * sink. Every store enforces Trusted Types, so on a category page it reached the
 * **default policy**, was sanitised, and logged
 * `[trusted-types] raw HTML reached a sink…` on every page load — for a string
 * that had already had its tags stripped on the line above and needed no HTML
 * parsing at all. Worse, it made the whole helper depend on that default policy
 * existing: without it, `innerHTML` under enforced Trusted Types **throws**, and
 * `applyPageMetadata()` would take the page title down with it.
 *
 * ⛔ `DOMParser.parseFromString` is not the way out — it is a TrustedHTML sink too.
 *
 * ⚠️ **Deliberately narrower than PHP's `html_entity_decode()`**, which the server
 * half uses. This handles the named entities a rich-text editor actually emits
 * plus numeric references; an exotic named entity (`&eacute;`) would decode on the
 * server and survive literally here. That divergence is cosmetic, in a meta tag,
 * and only reachable if a merchant types the entity by hand — Tiptap stores
 * accented characters as literal UTF-8. Not touching an HTML sink is worth more.
 */
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

const decodeEntities = (text) =>
    text.replace(/&(#[Xx]?[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]*);/g, (match, body) => {
        if (body[0] !== '#') {
            const named = NAMED_ENTITIES[body.toLowerCase()];

            return named === undefined ? match : named;
        }

        const hex = body[1] === 'x' || body[1] === 'X';
        const code = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);

        // Lone surrogates make String.fromCodePoint throw; leave them as written.
        const usable = Number.isInteger(code) && code > 0 && code <= 0x10ffff
            && !(code >= 0xd800 && code <= 0xdfff);

        return usable ? String.fromCodePoint(code) : match;
    });

export function summarise(html, limit = 160) {
    // A tag becomes a space so block boundaries do not weld two sentences
    // together, then the space it leaves against punctuation is removed again.
    // Both steps mirror \Setting\MetaTag::summarise() exactly — the two halves
    // must produce the same string, or the server/client agreement check that
    // guards this feature proves nothing.
    const withoutTags = String(html ?? '').replace(/<[^>]*>/g, ' ');
    const text = decodeEntities(withoutTags)
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\s+([.,;:!?])/g, '$1');

    if (text === '' || text.length <= limit) return text;

    const cut = text.slice(0, limit);
    const lastSpace = cut.lastIndexOf(' ');

    return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:-]+$/, '')}…`;
}

/**
 * The page's own name, qualified by the store. Never the bare store name —
 * that is the defect this file exists to remove.
 *
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function nameWithStore(name) {
    const trimmed = String(name ?? '').trim();

    // 🚨 `zucConfig`, not `window.zucConfig`. app.blade.php declares it as
    // `const zucConfig = …`, which creates a global LEXICAL binding — visible
    // as a free variable to every later script and module, and absent from
    // `window`. Reading it off `window` returns undefined and silently drops
    // the store name, which is how the client title came back as "Category"
    // while the server had rendered "Category | Store". The rest of the
    // codebase (useHelpers, useRedirect) uses the bare form for this reason.
    const store = String(
        (typeof zucConfig !== 'undefined' ? zucConfig?.store_name : '') ?? ''
    ).trim();

    if (!trimmed) return store;

    return store ? `${trimmed} | ${store}` : trimmed;
}

/**
 * The first candidate that is actually present.
 *
 * ⚠️ Candidates may be functions, and the expensive ones must be: JavaScript
 * evaluates every argument before the call, so passing `summarise(description)`
 * directly ran the whole strip-and-truncate pass on every page — including the
 * ones that had hand-written metadata and threw the result away. That is how the
 * Trusted Types warning showed up on a page whose description was never used,
 * which is also what identified this helper as the culprit.
 */
const firstNonBlank = (...candidates) => {
    for (const candidate of candidates) {
        const value = String((typeof candidate === 'function' ? candidate() : candidate) ?? '').trim();

        if (value !== '') {
            return value;
        }
    }

    return '';
};

/**
 * Apply a page's title and description, falling back the way the server does:
 * hand-written metadata, then the page's own content, then its name.
 *
 * @param {object} source
 * @param {string} [source.metaTitle]
 * @param {string} [source.metaDescription]
 * @param {string} [source.name]         the entity's own name
 * @param {string} [source.description]  the entity's own rich-text description
 */
export function applyPageMetadata({ metaTitle, metaDescription, name, description } = {}) {
    const fallback = nameWithStore(name);

    const title = firstNonBlank(metaTitle, fallback);
    if (title) document.title = title;

    const content = firstNonBlank(metaDescription, () => summarise(description), fallback);
    if (!content) return;

    let el = document.querySelector('meta[name="description"]');
    if (!el) {
        el = document.createElement('meta');
        el.name = 'description';
        document.head.appendChild(el);
    }
    el.content = content;
}
