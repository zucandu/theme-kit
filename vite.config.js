import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { zucThemeKit } from './runtime/kit-plugin.js';
import { fileURLToPath, URL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Theme Kit — Vite config.
 *
 * The whole design rests on one fact about the platform build: a theme file
 * addresses the platform only through the `@` alias, and its own files only
 * through `@theme`. So pointing `@` at ./shim and `@theme` at the developer's
 * theme folder runs the theme untouched, byte for byte. Nothing in the theme is
 * rewritten for local development, which is what makes "upload it and it works"
 * true rather than hopeful.
 *
 * `@storefront-plugins` resolves to a stub directory: storefront plugin addons
 * are installed per-store, and a theme must render without them.
 */
const themeDir = process.env.ZUC_THEME_DIR
    ? resolve(process.env.ZUC_THEME_DIR)
    : fileURLToPath(new URL('./theme', import.meta.url));

if (!existsSync(themeDir)) {
    throw new Error(
        `Theme directory not found: ${themeDir}\n` +
        `Point it at a themes/<name> folder (the one holding Storefront.vue, storefront/ and cores/):\n` +
        `  zuc-theme dev <path-to-theme>`
    );
}

for (const required of ['Storefront.vue', 'storefront']) {
    if (!existsSync(resolve(themeDir, required))) {
        throw new Error(`${themeDir} is not a theme folder — missing ${required}`);
    }
}

/**
 * Where fixture imagery is fetched from, in priority order.
 *
 * Two origins because the fixtures legitimately come from two stores: the
 * catalogue from the demo store, the articles from the main site. Both address
 * images by the same store-relative path, so the kit tries each in turn and
 * falls back to a placeholder — see the middleware in runtime/kit-plugin.js.
 *
 * A theme-kit.config.json may override this with `fixtureOrigin` (a string, or
 * null to work fully offline against placeholders).
 */
function resolveImageOrigins() {
    const origins = [];

    try {
        const discovered = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/_discovered.json', import.meta.url)), 'utf8'));
        if (discovered.base) origins.push(discovered.base);
        if (discovered.articleBase && discovered.articleBase !== discovered.base) origins.push(discovered.articleBase);
    } catch { /* fall through to the defaults below */ }

    if (origins.length === 0) origins.push('https://demo-store.zucandu.com', 'https://zucandu.com');

    try {
        const cfg = JSON.parse(readFileSync(resolve(themeDir, 'theme-kit.config.json'), 'utf8'));
        if ('fixtureOrigin' in cfg) return cfg.fixtureOrigin ? [cfg.fixtureOrigin] : [];
    } catch { /* no per-theme override */ }

    return origins;
}

const IMAGE_ORIGINS = resolveImageOrigins();

console.log(`[theme-kit] theme:  ${themeDir}`);
console.log(`[theme-kit] images: ${IMAGE_ORIGINS.join(', ') || 'placeholders only (offline)'}`);

/**
 * Map every library the kit ships to the kit's own node_modules.
 *
 * 🚨 Without this, a theme kept OUTSIDE the kit folder cannot build at all. Node
 * resolves a bare import by walking up from the importing FILE, and a theme
 * package is just .vue files — no node_modules anywhere above it. Storefront.vue
 * imports 'vue-i18n' on its first line and the build stops there. It only ever
 * worked while testing against a theme that happened to sit inside a project
 * with its own node_modules.
 *
 * It also bounds a theme to the libraries the platform ships: reach for one that
 * is not in package.json and the build fails here.
 *
 * 🚨 That failure is a WARNING, not a verdict — do not read it as "this theme
 * would be rejected". Installing a theme does not check its imports against a
 * package list; a bare specifier is simply resolved from the store's installed
 * modules like any other. So a library that is not on the published list but
 * happens to be installed there — including one pulled in only as some other
 * package's dependency — builds and ships perfectly well today.
 *
 * Which is why this list tracks what a store can RESOLVE, not what the docs
 * advertise. `@floating-ui/dom` is here for that reason alone: it is not on the
 * published list, but it is installed on every store as a transitive dependency,
 * and a theme that imports it works. Refusing it here would have failed a theme
 * that a real store runs — the kit's one unforgivable error.
 *
 * The flip side is worth saying out loud to a theme developer: a library you
 * reach only through someone else's dependency is not promised to you. The day
 * the package that pulls it in is dropped, that import breaks on every store at
 * once. Ask for it to be added properly rather than relying on the hoist.
 */
function dependencyAliases() {
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'));
    const nodeModules = fileURLToPath(new URL('./node_modules', import.meta.url));

    // String `find` matches the bare name or a subpath ('@heroicons/vue/24/outline',
    // 'vue-toastification/dist/index.css'), so one entry per package covers both.
    return Object.keys(pkg.dependencies ?? {}).map((name) => ({
        find: name,
        replacement: resolve(nodeModules, name),
    }));
}

export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    resolve: {
        // An ARRAY, because order decides precedence and one rule has to win over
        // another: '@theme/cores' must be tried before '@theme', or a theme file
        // importing '@theme/cores/PriceDisplay.vue' resolves into the developer's
        // folder — where, correctly, no cores/ exists.
        alias: [
            { find: '@theme/cores', replacement: fileURLToPath(new URL('./runtime/cores', import.meta.url)) },
            { find: '@theme', replacement: themeDir },
            { find: '@storefront-plugins', replacement: fileURLToPath(new URL('./runtime/plugins-stub', import.meta.url)) },
            { find: '@', replacement: fileURLToPath(new URL('./shim', import.meta.url)) },
            ...dependencyAliases(),
        ],
    },
    server: {
        port: 5180,
        open: true,

        // The theme normally sits OUTSIDE this folder, so the dev server has to be
        // told it may read from there — Vite refuses paths outside its root by
        // default, and the refusal surfaces as a 404 on the page component rather
        // than as a permissions message.
        //
        // On Windows a theme on a different drive letter than the kit (C: vs D:)
        // fails this way even with the path allowed, because the served URL loses
        // the drive separator. Keep the kit and the theme on one drive; the
        // production build has no such limit.
        fs: {
            allow: [fileURLToPath(new URL('.', import.meta.url)), themeDir],
        },
    },
    build: { outDir: 'dist' },
    plugins: [zucThemeKit({ themeDir, imageOrigins: IMAGE_ORIGINS }), vue()],
});
