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

for (const required of ['Storefront.vue', 'storefront', 'cores']) {
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

export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./shim', import.meta.url)),
            '@theme': themeDir,
            '@storefront-plugins': fileURLToPath(new URL('./runtime/plugins-stub', import.meta.url)),
        },
    },
    server: { port: 5180, open: true },
    build: { outDir: 'dist' },
    plugins: [zucThemeKit({ themeDir, imageOrigins: IMAGE_ORIGINS }), vue()],
});
