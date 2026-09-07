import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseThemeConfig, defaultsOf } from '../tools/theme-settings.mjs';

const VIRTUAL_ID = 'virtual:zuc-theme-config';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

/**
 * What the placeholder is allowed to stand in for.
 *
 * 🚨 Only images. `/storage/` is the whole public disk, not an image folder —
 * fonts, PDFs, videos and CSV exports live there too, and answering one of those
 * with an SVG under `200 OK` is worse than a 404 in every case, because nothing
 * downstream can tell it went wrong.
 *
 * A theme's `@font-face` was the case that showed it. The browser fetched
 * `/storage/fonts/lato/lato-v25-latin-700.woff2`, got 373 bytes of SVG with a
 * 200, and reported it as a corrupt font:
 *
 *     Failed to decode downloaded font: .../lato-v25-latin-700.woff2
 *     OTS parsing error: invalid sfntVersion: 1014199911
 *
 * The page then rendered in a fallback face on every route. A developer reading
 * that message looks for a bad font file; the file was never the problem.
 */
const IMAGE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

/** The "no image" card, for photos. */
const PHOTO = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">',
    '<rect width="600" height="600" fill="#f1eee8"/>',
    '<path d="M180 380l90-110 70 85 45-55 75 80z" fill="#d8d1c4"/>',
    '<circle cx="235" cy="225" r="34" fill="#d8d1c4"/>',
    '<text x="300" y="470" text-anchor="middle" font-family="system-ui,sans-serif"',
    ' font-size="26" fill="#a9a094">no image</text>',
    '</svg>',
].join('');

/**
 * A plain glyph for icons. Deliberately a simple filled shape, because these are
 * rendered as a CSS mask rather than an <img> — the account menu paints them with
 * `currentColor` through `mask-image`. Under a mask, every non-transparent pixel
 * becomes solid colour, so the "no image" card above would come out as a large
 * coloured block where a small icon belongs.
 */
const GLYPH = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">',
    '<rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="#000" stroke-width="1.8"/>',
    '<circle cx="12" cy="12" r="3" fill="#000"/>',
    '</svg>',
].join('');

/** Windows hands ids back with both separators; compare on one. */
const slash = (p) => p.split('\\').join('/');

/** Where the `@` alias points. Kept here so the resolver can check it by hand. */
const SHIM = fileURLToPath(new URL('../shim', import.meta.url));

/** Module names that DO exist beside the one that was asked for. */
function neighbours(target) {
    try {
        return readdirSync(dirname(target))
            .filter((name) => name.endsWith('.js'))
            .map((name) => name.replace(/\.js$/, ''))
            .sort();
    } catch {
        // The folder itself does not exist — the specifier is wrong at a level
        // above the filename, and there is nothing useful to list.
        return [];
    }
}

export function zucThemeKit({ themeDir, imageOrigins = [] }) {
    return {
        name: 'zuc-theme-kit',
        enforce: 'pre',

        /**
         * Serve /storage and /images by trying each configured origin in turn, then
         * falling back to a placeholder.
         *
         * A plain Vite proxy cannot do this: it targets ONE host, and the fixtures
         * legitimately span two — the catalogue was captured from the demo store,
         * the articles from the main site — with both addressing images by the same
         * store-relative /storage/<size>/<file> path. A single target 404s half of
         * them, and a 404 renders as a broken-image icon rather than anything a
         * developer can lay out against.
         *
         * Read-only image traffic only. No API call is ever forwarded: the point of
         * the kit is that a theme runs with no store behind it, and quietly proxying
         * data would hide a missing fixture instead of reporting it.
         */
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const path = (req.url || '').split('?')[0];
                if (!path.startsWith('/storage/') && !path.startsWith('/images/')) return next();

                for (const origin of imageOrigins) {
                    try {
                        const upstream = await fetch(origin + req.url);
                        if (!upstream.ok) continue;

                        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
                        res.setHeader('Cache-Control', 'public, max-age=3600');
                        res.end(Buffer.from(await upstream.arrayBuffer()));
                        return;
                    } catch {
                        // Origin unreachable — try the next, then the placeholder.
                    }
                }

                // Anything that is not an image gets the honest answer. A theme
                // asking for a font or a download it did not ship should see it
                // missing, not receive a picture pretending to be one.
                if (!IMAGE.test(path)) {
                    res.statusCode = 404;
                    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.end(
                        `[theme-kit] ${path} is not on the fixture store, and the kit only`
                        + ' substitutes images. Ship this file with your theme, or point'
                        + ' fixtureOrigin at a store that serves it.\n'
                    );
                    return;
                }

                res.setHeader('Content-Type', 'image/svg+xml');
                res.setHeader('Cache-Control', 'no-cache');
                res.end(path.endsWith('.svg') ? GLYPH : PHOTO);
            });
        },

        /**
         * Answer the virtual config module, and explain a `@/` import the shim
         * does not carry.
         *
         * 🚨 Without the second half, reaching for a platform module the kit has
         * not mirrored fails like this:
         *
         *     × [plugin vite:import-analysis] .../Schematic.vue
         *       The system cannot find the file specified. (os error 2)
         *
         * That names a file the developer did not write, does not say which
         * import was at fault, and reads like a broken install of the kit. It is
         * none of those: `@/` is the platform surface, `shim/` is the kit's copy
         * of it, and the copy is incomplete. Saying so — and listing the names
         * that DO exist in that folder, since the usual cause is a typo — turns a
         * dead end into a one-line fix or a one-line bug report.
         */
        resolveId(id, importer) {
            if (id === VIRTUAL_ID) return RESOLVED_ID;

            // 🚨 Match on the ALIASED path, not on '@/'. Vite rewrites the alias
            // before any plugin's resolveId sees the id, so a guard looking for
            // the '@/' prefix never fires and the raw rolldown error stands.
            const target = slash(id);
            if (!target.startsWith(slash(SHIM) + '/')) return null;

            const found = ['', '.js', '.mjs', '.json', '/index.js']
                .some((suffix) => existsSync(target + suffix));

            if (found) return null;

            const specifier = '@/' + target.slice(slash(SHIM).length + 1);
            const from = importer ? slash(importer).replace(slash(themeDir), '<theme>') : 'A theme file';
            const siblings = neighbours(target);

            throw new Error(
                `\n  ${from}\n  imports ${specifier}, which this kit does not provide.\n\n`
                + `  '@/' is the platform's own surface and shim/ is the kit's copy of it,\n`
                + `  so either the name is wrong or the kit is missing a module the platform\n`
                + `  ships. Both are worth reporting.\n`
                + (siblings.length
                    ? `\n  @/${dirname(target).slice(slash(SHIM).length + 1)}/ provides:\n    ${siblings.join('\n    ')}\n`
                    : '')
            );
        },

        /**
         * Reload when theme-kit.config.json changes.
         *
         * Its contents are baked into a virtual module, which Vite has no reason
         * to associate with a JSON file it never saw imported — so without this,
         * editing a setting looked like it did nothing until the server was
         * restarted, and the obvious conclusion to draw was that the setting
         * itself was broken. Settings are exactly the thing you sit and tweak.
         *
         * A full reload rather than an HMR update: `zucConfig` is installed on
         * `window` once, before the app mounts, so nothing downstream is prepared
         * to see it change underneath.
         */
        handleHotUpdate({ file, server }) {
            if (resolve(file) !== resolve(themeDir, 'theme-kit.config.json')) return;

            const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
            if (mod) server.moduleGraph.invalidateModule(mod);

            server.ws.send({ type: 'full-reload' });

            return [];
        },

        load(id) {
            if (id !== RESOLVED_ID) return null;

            let config = {};
            const configPath = resolve(themeDir, 'theme-kit.config.json');
            if (existsSync(configPath)) {
                try {
                    config = JSON.parse(readFileSync(configPath, 'utf8'));
                } catch (e) {
                    this.warn(`theme-kit.config.json is not valid JSON, ignoring it: ${e.message}`);
                }
            }

            // Optional per-theme translations: <theme>/locales/<code>.json
            const messages = {};
            const localesDir = resolve(themeDir, 'locales');
            if (existsSync(localesDir)) {
                for (const file of readdirSync(localesDir)) {
                    const m = file.match(/^([A-Za-z0-9_-]+)\.json$/);
                    if (!m) continue;
                    try {
                        messages[m[1]] = JSON.parse(readFileSync(join(localesDir, file), 'utf8'));
                    } catch (e) {
                        this.warn(`locales/${file} is not valid JSON, skipping it: ${e.message}`);
                    }
                }
            }

            // The theme's own settings, seeded from their declared defaults.
            //
            // A store projects the ACTIVE theme's values under one namespaced key
            // and a theme reads `zucConfig.theme_<slug>.x`. Namespacing by slug is
            // what makes a component copied out of another theme fail visibly
            // instead of quietly reading undefined, so the kit has to namespace it
            // the same way or that safety net is missing exactly where it is being
            // built. The slug defaults to the theme folder's name.
            //
            // 🚨 A bad declaration WARNS and is skipped rather than stopping the
            // dev server. You are usually mid-edit when it is malformed, and taking
            // the whole storefront down over one settings block would hide the page
            // you are working on. `zuc-theme export` refuses instead — that is the
            // point at which it has to be right.
            const themeSlug = config.slug || basename(themeDir);
            let themeSettings = {};

            if (config.theme_config !== undefined) {
                try {
                    themeSettings = { [`theme_${themeSlug}`]: defaultsOf(parseThemeConfig(config.theme_config)) };
                } catch (e) {
                    this.warn(`theme_config is not valid, ignoring it: ${e.message}`);
                }
            }

            return `export default ${JSON.stringify({
                locale: config.locale || 'en',
                // Theme settings first, so an explicit `zucConfig` override in the
                // same file still wins — it is the more specific instruction.
                zucConfig: { ...themeSettings, ...(config.zucConfig || {}) },
                messages,
            })};`;
        },

        transform(code, id) {
            if (!id.endsWith('runtime/app.css') && !id.endsWith('runtime\app.css')) return null;

            const base = themeDir.split(String.fromCharCode(92)).join('/');

            // 🚨 Scope to the STOREFRONT subtrees, never the theme root.
            //
            // A theme folder also contains admin/, and Tailwind has no idea that is
            // out of scope — pointing @source at the root pulls every admin-only
            // utility into the storefront stylesheet. Measured on the default theme:
            // 197,122 bytes scanning the root versus 112 kB scanning only these
            // three, i.e. nearly half the render-blocking CSS was admin.
            //
            // Storefront.vue is named explicitly because it sits at the theme root,
            // beside admin/, rather than inside storefront/.
            return code
                .replace('@source "../theme/storefront";', `@source "${base}/storefront";`)
                .replace('@source "../theme/Storefront.vue";', `@source "${base}/Storefront.vue";`);
        },
    };
}
