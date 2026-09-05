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

const results = { ok: [], failed: [] };

async function get(path) {
    const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

async function save(name, data) {
    const file = join(ROOT, 'fixtures', `${name}.json`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
    results.ok.push(`${name}.json  (${(Buffer.byteLength(JSON.stringify(data)) / 1024).toFixed(1)} KB)`);
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
    await capture('banners', '/banner-all');
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
    for (const type of MENU_TYPES) {
        try {
            const fetched = (await get(`/menu/${type}`)).menu ?? null;
            if (fetched) menus[type] = fetched;
            else if (!menus[type]) menus[type] = null;
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
    const pickSlugs = (payload) => {
        const rows = Array.isArray(payload) ? payload : Object.values(payload).flat().filter(Boolean);
        const slugOf = (p) => p?.slug ?? p?.translations?.find((t) => t && t.slug)?.slug ?? null;
        return {
            simple: slugOf(rows.find((p) => p && p.type === 'simple')),
            variable: slugOf(rows.find((p) => p && p.type && p.type !== 'simple')),
        };
    };

    let slugs = { simple: null, variable: null };
    try {
        slugs = pickSlugs(await get('/product/spotlight'));
        if (!slugs.variable) {
            const fromSearch = pickSlugs((await get('/search/result?keyword=a')).paginator?.data ?? []);
            slugs.variable = fromSearch.variable;
            slugs.simple = slugs.simple ?? fromSearch.simple;
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
    try {
        const previous = JSON.parse(readFileSync(join(ROOT, 'fixtures', '_discovered.json'), 'utf8'));
        if (previous.variableSlug) {
            await get('/product/' + previous.variableSlug);
            slugs.variable = previous.variableSlug;
        }
        if (previous.simpleSlug) slugs.simple = previous.simpleSlug;
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
};

main().catch(e => { console.error(e); process.exit(1); });
