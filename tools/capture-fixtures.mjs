/**
 * Fixture capture — pulls real storefront API responses from a live demo store
 * and writes them to fixtures/ for the shim layer to serve.
 *
 * Fixtures MUST come from a real response, never be hand-written: the whole
 * point of the shim is that a theme built against it meets the same data shape
 * it will meet on a live store. A hand-typed fixture is a guess, and a wrong
 * guess only surfaces after the dev has already uploaded their theme.
 *
 * Storefront endpoints only — nothing under /admin is captured or shimmed.
 *
 * Usage: node tools/capture-fixtures.mjs [baseUrl]
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.argv[2] || 'https://demo-store.zucandu.com').replace(/\/$/, '');
const API = `${BASE}/api/v3/storefront`;

/**
 * Articles come from their own origin, because the demo store carries two of them
 * (a privacy notice and a terms page) and a theme's blog listing, cards, author
 * and category pages cannot be judged against that. The main site has a real set.
 * Override with the second argument.
 */
const ARTICLE_BASE = (process.argv[3] || 'https://zucandu.com').replace(/\/$/, '');
const ARTICLE_API = `${ARTICLE_BASE}/api/v3/storefront`;

async function getFrom(api, path) {
    const res = await fetch(`${api}${path}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

/** Menu types the default theme actually asks for — Header/Footer/ServiceBar/account/Menu.vue */
/**
 * Legal pages every store ships with. They are articles, so they come back at the
 * top of the blog listing alongside real posts — and a blog whose first two cards
 * are a privacy notice and a terms page tells a theme developer nothing about how
 * their card, excerpt and thumbnail actually look.
 *
 * They are pushed to the end rather than dropped: they exist on a real store, they
 * have no excerpt and no interesting image, and a theme has to render that case too.
 */
const DEMOTED_ARTICLES = ['privacy-notice', 'conditions-of-use'];

/** Sort marker for a demoted article. Nothing sorts by it - the ORDER of the array
 * is what the theme renders - but leaving the field at 0 while the row sits last
 * would read as a data error to the next person who opens the fixture. */
const DEMOTED_SORT = 999;

function demoteLegalPages(listing) {
    const rows = listing.paginator?.data;
    if (!Array.isArray(rows)) return listing;

    const isDemoted = (row) => DEMOTED_ARTICLES.includes(row?.translations?.find((t) => t && t.slug)?.slug);

    for (const row of rows) {
        if (isDemoted(row)) row.sort = DEMOTED_SORT;
    }

    listing.paginator.data = [...rows.filter((r) => !isDemoted(r)), ...rows.filter(isDemoted)];

    return listing;
}

const MENU_TYPES = ['primary', 'tertiary', 'home-top', 'footer-middle', 'footer-bottom', 'account'];

/**
 * Paths this kit's router actually serves, as patterns.
 *
 * 🚨 Menu and banner destinations are FREE TEXT a merchant types into an admin
 * form, so a captured store's are only as good as whoever typed them — and the
 * demo store's are not good. Its nav points at `blog/posts` and
 * `account/orders/list`; the real route table (v3 routes/storefront.js, mirrored
 * in runtime/router.js) has `blog/listing` and `account/order/list`. Its hero
 * button points at the bare slug `coffee-machine-bugatti-diva`, with no leading
 * slash and no /product/ prefix, which the catch-all sends to /page-not-found.
 *
 * Those were fixed by hand in the fixtures, and RE-CAPTURING PUT THEM BACK —
 * silently, every time. That is the worst shape for this: the tool exists to
 * refresh demo content, and it was quietly reintroducing dead links into the
 * one thing a theme developer clicks first.
 *
 * So a captured destination is now checked, and a dead one loses to the value
 * already on disk. A destination that resolves is taken as captured, which is
 * the whole point of running the tool.
 */
const ROUTES = [
    /^\/?$/,
    /^\/?(cart|checkout|contact-us|login|register|logout|unsubscribe|page-not-found)$/,
    /^\/?(category|manufacturer|product|article|product-review-write)\/[^/]+$/,
    /^\/?search\/result$/,
    /^\/?blog(\/(listing|search))?$/,
    /^\/?blog\/(category|author)\/[^/]+$/,
    /^\/?(track-order|return-exchange)\/[^/]+$/,
    /^\/?account(\/(profile|password|wishlist|quick-reorder|back-in-stock|address-book))?$/,
    /^\/?account\/order\/[^/]+$/,
    /^\/?(invoice|pay)\/[^/]+$/,
    /^\/?wishlist\/shared\/[^/]+$/,
    /^\/?forgot-password$/,
    /^\/?reset-password\/[^/]+$/,
];

/**
 * Compose the path a theme will actually navigate to.
 *
 * 🚨 A menu url is NOT a path. It is a slug, and the item's `link` decides the
 * prefix — this is useHelpers' `buildPath`, and getting it wrong here would
 * condemn every category entry in the nav: `appliances` is correct data that
 * becomes `/category/appliances`, not a dead link. Banners carry no `link` and
 * their CTA really is a path, so they fall through unchanged.
 */
const buildPath = (link, slug) => {
    const clean = String(slug ?? '').replace(/^\/+/, '');
    if (!link) return String(slug ?? '');
    if (['page', 'banner'].includes(link)) return `/${clean}`;
    return `/${link.replace(/_/g, '/')}/${clean}`;
};

/** Does this kit serve that destination? Empty means "not a link", which is fine. */
const resolves = (url) => {
    if (url === undefined || url === null || url === '') return true;
    const path = String(url).split('?')[0].split('#')[0];
    return ROUTES.some((pattern) => pattern.test(path));
};

/**
 * Walk a captured tree and put back any destination that would dead-end.
 *
 * Matched positionally against the previous capture is NOT possible — menus get
 * reordered — so it matches on the sibling text instead: a menu entry keeps its
 * old url when its title still matches, which is the only stable handle a
 * merchant-edited row has.
 */
function keepWorkingLinks(fetched, previous, fields, kept, unset = []) {
    const index = new Map();

    // ⚠️ A destination can resolve and still be worth replacing. A hero button
    // pointing at "/" is not a destination — it is the page the shopper is
    // already on, which is what an unfilled admin field looks like once rendered.
    // Three of the four captured CTAs are exactly that. Menus are NOT given this
    // rule: their "Home" entry legitimately points at "/".
    const isUnset = (value) => unset.includes(String(value ?? ''));

    // `link` lives on the menu ITEM while the url lives on its translation, so it
    // is carried down rather than read off the node holding the field.
    const walk = (node, link, visit) => {
        if (Array.isArray(node)) return node.forEach((child) => walk(child, link, visit));
        if (!node || typeof node !== 'object') return;

        const scope = node.link ?? link;
        visit(node, scope);
        Object.values(node).forEach((child) => walk(child, scope, visit));
    };

    walk(previous, null, (node) => {
        if (node.title) index.set(String(node.title), node);
    });

    walk(fetched, null, (node, link) => {
        const older = index.get(String(node.title));

        for (const field of fields) {
            if (!(field in node)) continue;

            const captured = node[field];
            const dead = !resolves(buildPath(link, captured));
            if (!dead && !isUnset(captured)) continue;

            const replacement = older?.[field];
            const label = node.title ?? '(untitled)';

            if (replacement === undefined || isUnset(replacement) || !resolves(buildPath(link, replacement))) {
                if (dead) kept.push(`${label}: ${captured} does not resolve, and nothing on disk to keep`);
                continue;
            }

            kept.push(`${label}: ${dead ? captured : `${captured} (unset)`} -> kept ${replacement}`);
            node[field] = replacement;
        }
    });

    return fetched;
}

/** Read a fixture already on disk, or null. */
function onDisk(name) {
    try {
        return JSON.parse(readFileSync(join(ROOT, 'fixtures', `${name}.json`), 'utf8'));
    } catch {
        return null;
    }
}

const results = { ok: [], failed: [] };

async function get(path) {
    const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function save(name, data) {
    const file = join(ROOT, 'fixtures', `${name}.json`);

    // 🚨 A key beginning with `_` is a NOTE somebody wrote by hand — why a value
    // is what it is, what to change to preview another state. No endpoint returns
    // one, so overwriting the file with the captured payload deleted every one of
    // them, silently, on every run. They are carried across instead. Captured data
    // still wins for every real key.
    const notes = {};
    const existing = onDisk(name);
    if (existing && !Array.isArray(existing)) {
        for (const [key, value] of Object.entries(existing)) {
            if (key.startsWith('_')) notes[key] = value;
        }
    }

    const payload = (data && !Array.isArray(data) && typeof data === 'object')
        ? { ...notes, ...data }
        : data;

    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    results.ok.push(`${name}.json  (${(Buffer.byteLength(JSON.stringify(payload)) / 1024).toFixed(1)} KB)`);
}

async function capture(name, path) {
    try { await save(name, await get(path)); }
    catch (e) { results.failed.push(`${name}  ${path}  -> ${e.message}`); }
}

/**
 * Collect slugs of menu elements that actually point at a category.
 *
 * Menu entries carry link:'category' alongside a translated `url` holding the
 * slug. Plain link:'page' entries point at '/' and are not listing routes, so
 * keying off `url` alone picks the wrong thing — that is what made the first
 * run request /category/listing/page and 404.
 */
function collectCategorySlugs(node, out = []) {
    if (Array.isArray(node)) { node.forEach(n => collectCategorySlugs(n, out)); return out; }
    if (node && typeof node === 'object') {
        if (node.link === 'category' && Array.isArray(node.translations)) {
            const slug = node.translations.find(t => t && t.url)?.url;
            if (slug && slug !== '/') out.push(String(slug).replace(/^\/+|\/+$/g, ''));
        }
        Object.values(node).forEach(v => collectCategorySlugs(v, out));
    }
    return out;
}

const main = async () => {
    console.log(`Capturing from ${API}\n`);

    // Settings & chrome
    await capture('setting', '/setting');
    // Banner CTAs are merchant free text; a dead one loses to what is on disk.
    const keptBannerLinks = [];
    try {
        const banners = keepWorkingLinks(
            await get('/banner-all'),
            onDisk('banners') ?? {},
            ['url_primary', 'url_secondary'],
            keptBannerLinks,
            ['/', '']
        );
        await save('banners', banners);
    } catch (e) {
        results.failed.push(`banners  /banner-all  -> ${e.message}`);
    }
    await capture('countries', '/country/list');
    await capture('manufacturers', '/manufacturer/all');
    await capture('filterable-attributes', '/attribute/filterable-attributes');
    await capture('return-reasons', '/return-reasons');
    await capture('return-resolutions', '/return-resolutions');

    // Menus
    // Keep whatever is already on disk for any menu the store does not define.
    //
    // 🚨 Without this, re-running capture WIPES the account navigation. Not every
    // store configures every menu - the demo has no account menu at all, so
    // /menu/account answers `{"menu": null}` - and a null is not a correction to a
    // menu that was authored by hand. Overwriting one with the other silently
    // empties the account sidebar and nothing reports it.
    let existingMenus = {};
    try {
        existingMenus = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'menus.json'), 'utf8'));
    } catch { /* first run, nothing to keep */ }

    const menus = { ...existingMenus };
    const keptMenuLinks = [];
    for (const type of MENU_TYPES) {
        try {
            const fetched = (await get(`/menu/${type}`)).menu ?? null;
            // A menu entry's `url` is merchant free text too, and the demo store's
            // points at routes that do not exist. Same rule as the banners.
            if (fetched) {
                menus[type] = keepWorkingLinks(
                    fetched,
                    existingMenus[type] ?? {},
                    ['url'],
                    keptMenuLinks
                );
            } else if (!menus[type]) {
                menus[type] = null;
            }
        } catch (e) {
            results.failed.push(`menu/${type} -> ${e.message}`);
            menus[type] ??= null;
        }
    }
    await save('menus', menus);

    // Catalog
    await capture('product-spotlight', '/product/spotlight');
    await capture('product-widgets', '/product/widgets');
    await capture('search-result', '/search/result?keyword=a');

    // Discover product slugs. A CONFIGURABLE product is captured deliberately and
    // separately: the first slug the spotlight happens to return is usually a simple
    // product with zero attributes and zero children, and against that fixture the
    // variant picker renders nothing at all — a developer would have no way to design
    // the one part of the product page that is hardest to get right.
    /**
     * 🚨 A listing row's `type` does NOT decide what /product/<slug> answers with.
     *
     * A row for a VARIANT carries the child's slug and the child's type — `simple`
     * — but the detail endpoint resolves that slug to its PARENT and answers with
     * the configurable product. Trusting the row is how this shipped a
     * product-details-simple.json that was a byte-for-byte duplicate of the
     * configurable one (both id 238, both `type: configurable`), which meant the
     * simple-product layout — no variant picker, straight to add-to-cart — could
     * never be looked at. Measured against the demo store:
     *
     *   spotlight row 'presslane-bands-cap-black-one-size'  type simple
     *   GET /product/presslane-bands-cap-black-one-size     id 220, CONFIGURABLE
     *   GET /product/umbra-saddle-sink-caddy                id 37,  simple
     *
     * So candidates are gathered from the rows and then CONFIRMED by fetching each
     * one, taking the first whose answer really is the type we are after.
     */
    const candidateSlugs = (payload) => {
        const rows = Array.isArray(payload) ? payload : Object.values(payload).flat().filter(Boolean);
        const slugOf = (p) => p?.slug ?? p?.translations?.find((t) => t && t.slug)?.slug ?? null;
        return [...new Set(rows.map(slugOf).filter(Boolean))];
    };

    /** First candidate whose DETAIL response matches, or null. */
    const confirmSlug = async (candidates, wanted) => {
        for (const slug of candidates) {
            try {
                const type = (await get('/product/' + slug))?.product?.type;
                const isSimple = type === 'simple';
                if (wanted === 'simple' ? isSimple : !isSimple && Boolean(type)) return slug;
            } catch { /* gone or not addressable by that slug — try the next */ }
        }
        return null;
    };

    let slugs = { simple: null, variable: null };
    try {
        let candidates = candidateSlugs(await get('/product/spotlight'));
        slugs.simple = await confirmSlug(candidates, 'simple');
        slugs.variable = await confirmSlug(candidates, 'variable');

        if (!slugs.simple || !slugs.variable) {
            candidates = candidateSlugs((await get('/search/result?keyword=a')).paginator?.data ?? []);
            slugs.simple = slugs.simple ?? await confirmSlug(candidates, 'simple');
            slugs.variable = slugs.variable ?? await confirmSlug(candidates, 'variable');
        }
    } catch (e) { results.failed.push('product slug discovery -> ' + e.message); }

    // Prefer the product a previous run already captured.
    //
    // 🚨 Discovery alone is NOT stable: /product/spotlight rotates, so two runs a
    // minute apart return different products. product-variants.json is derived from
    // whichever product was captured, and once the two disagree the variant picker
    // renders options that belong to something else — with no error anywhere.
    // Pinning to the previous slug keeps recapture idempotent; the guard below
    // catches the case where the pin itself had to change.
    // ⚠️ A pin is only honoured if it still ANSWERS with the type it was pinned for.
    // The previous version took `simpleSlug` on trust and never fetched it, which is
    // what let a stale, wrong pin survive every recapture: the slug had long resolved
    // to a configurable parent, and re-running the tool faithfully reproduced the
    // duplicate every time.
    try {
        const previous = JSON.parse(readFileSync(join(ROOT, 'fixtures', '_discovered.json'), 'utf8'));
        if (previous.variableSlug) {
            slugs.variable = await confirmSlug([previous.variableSlug], 'variable') ?? slugs.variable;
        }
        if (previous.simpleSlug) {
            slugs.simple = await confirmSlug([previous.simpleSlug], 'simple') ?? slugs.simple;
        }
    } catch { /* no previous run, or that product is gone - use what was discovered */ }

    const productSlug = slugs.variable ?? slugs.simple;

    if (slugs.simple) await capture('product-details-simple', '/product/' + slugs.simple);
    else results.failed.push('no simple product found to capture');

    if (slugs.variable) await capture('product-details', '/product/' + slugs.variable);
    else results.failed.push('no configurable product found — the variant picker will render empty');

    if (productSlug) {
        try {
            const details = await get('/product/' + productSlug);
            const id = details?.product?.id ?? details?.id;
            if (id) {
                await capture('product-reviews', '/product/' + id + '/reviews');
                await capture('product-cross-sells', '/product/' + id + '/cross-sells');
                await capture('product-up-sells', '/product/' + id + '/up-sells');
                await capture('product-adjacent', '/product/' + id + '/adjacent');
            } else {
                results.failed.push('product id not found; review/cross-sell fixtures skipped');
            }
        } catch (e) { results.failed.push('product detail follow-ups -> ' + e.message); }
    }

    // Blog, from its own origin (see ARTICLE_BASE). The slug is discovered from the
    // listing rather than hardcoded: every store's article set differs, and a broken
    // article page is an easy thing for a theme to ship unnoticed.
    try {
        const listing = demoteLegalPages(await getFrom(ARTICLE_API, '/article/listing'));
        await save('article-listing', listing);

        // First row after the demotion, so the detail fixture is a real post.
        const rows = listing.paginator?.data ?? [];
        const slug = rows.map((r) => r?.translations?.find((t) => t && t.slug)?.slug).find(Boolean);

        if (slug) {
            await save('article-details', await getFrom(ARTICLE_API, '/article/' + slug));
        } else {
            results.failed.push('no article slug discoverable from /article/listing');
        }
    } catch (e) {
        results.failed.push('articles (' + ARTICLE_BASE + ') -> ' + e.message);
    }

    // Category listing, keyed off a slug discovered in the menus
    const categorySlug = collectCategorySlugs(Object.values(menus))[0] ?? null;
    if (categorySlug) await capture('category-listing', `/category/listing/${categorySlug}`);
    else results.failed.push('no category slug discoverable from any captured menu');

    await save('_discovered', { base: BASE, articleBase: ARTICLE_BASE, productSlug, simpleSlug: slugs.simple, variableSlug: slugs.variable, categorySlug, capturedAt: new Date().toISOString() });

    // product-variants.json is precomputed from ONE product. If capture landed on a
    // different one, the picker would silently show another product's options.
    try {
        const variants = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'product-variants.json'), 'utf8'));
        const captured = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'product-details.json'), 'utf8')).product;

        if (variants._source_product_id !== captured.id) {
            console.log('');
            console.log('!! product-variants.json is STALE.');
            console.log('   It was derived from product ' + variants._source_product_id + ' (' + variants._source_slug + '),');
            console.log('   but this run captured product ' + captured.id + '.');
            console.log('   The variant picker will show options belonging to the wrong product.');
            console.log('   Fix: re-derive it, or re-run against the original slug:');
            console.log('     node tools/capture-fixtures.mjs ' + BASE + '  (with fixtures/_discovered.json intact)');
        }
    } catch { /* fixture missing - nothing to compare */ }

    console.log(`OK ${results.ok.length} fixtures written:`);
    results.ok.forEach(l => console.log(`   ${l}`));
    if (results.failed.length) {
        console.log(`\n!! ${results.failed.length} failed:`);
        results.failed.forEach(l => console.log(`   ${l}`));
    }

    // Said out loud, because a link this tool silently reverted is a link the
    // developer will otherwise assume it refreshed.
    const kept = [...keptBannerLinks, ...keptMenuLinks];
    if (kept.length) {
        console.log(`\n:: ${kept.length} captured destination(s) do not resolve in this kit:`);
        kept.forEach(l => console.log(`   ${l}`));
        console.log('   These are free text a merchant typed. The store has them wrong, not the kit.');
    }
};

main().catch(e => { console.error(e); process.exit(1); });
