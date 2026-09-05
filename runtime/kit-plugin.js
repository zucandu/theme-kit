import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const VIRTUAL_ID = 'virtual:zuc-theme-config';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

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

                res.setHeader('Content-Type', 'image/svg+xml');
                res.setHeader('Cache-Control', 'no-cache');
                res.end(path.endsWith('.svg') ? GLYPH : PHOTO);
            });
        },

        resolveId(id) {
            return id === VIRTUAL_ID ? RESOLVED_ID : null;
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

            return `export default ${JSON.stringify({
                locale: config.locale || 'en',
                zucConfig: config.zucConfig || {},
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
                .replace('@source "../theme/cores";', `@source "${base}/cores";`)
                .replace('@source "../theme/Storefront.vue";', `@source "${base}/Storefront.vue";`);
        },
    };
}
