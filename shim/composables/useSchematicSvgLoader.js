/**
 * Schematic SVG loader.
 *
 * A theme that renders an exploded parts diagram fetches the drawing itself and
 * inlines it, rather than putting it in an `<img>` — inline SVG is the only way
 * its shapes can be clicked, highlighted or zoomed. `article.meta.schematic_svg`
 * holds the URL; this fetches it as text.
 *
 * 🚨 The kit shipped without this and `zuc-theme build` DIED on any theme that
 * imports it, with nothing that named the cause:
 *
 *     × [plugin vite:import-analysis] .../Schematic.vue
 *       import { loadSchematicSvg } from "@/composables/useSchematicSvgLoader";
 *       The system cannot find the file specified. (os error 2)
 *
 * No v3 file imports it, which is why it was easy to miss — but the platform
 * ships it, so a theme may import it and does. "Nothing on the platform uses it"
 * is not a reason to leave it out of a surface the platform exposes.
 *
 * The URL validation is kept EXACTLY as the platform's, including throwing on an
 * empty URL and on a non-http protocol, because a theme's error handling is built
 * against those throws and has to be exercisable here.
 *
 * What is NOT kept is the network call: the kit contacts nothing. It answers with
 * a drawing instead, so the viewer a theme wraps around this — hotspots, zoom,
 * the part list beside it — has real geometry to lay out. Every other surface in
 * the kit renders against a fixture; so does this one.
 */

/** The platform's own check, unchanged. */
function normalizeSchematicUrl(url) {
    if (!url) {
        throw new Error('Schematic SVG URL is empty.');
    }

    const target = new URL(url, window.location.origin);
    if (!['http:', 'https:'].includes(target.protocol)) {
        throw new Error('Schematic SVG URL must be http or https.');
    }

    return target.href;
}

/**
 * A stand-in exploded diagram.
 *
 * Deliberately NOT a single grey rectangle. A schematic viewer is judged on
 * things a placeholder box cannot show: numbered callouts a part list has to
 * line up with, shapes far enough apart to test hit targets, and an aspect ratio
 * wide enough to make the zoom controls matter. `id` and `data-part` are on each
 * group because that is how a theme finds a shape to highlight.
 */
const FIXTURE_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" role="img"',
    ' aria-label="Sample parts diagram">',
    '<rect width="800" height="500" fill="#faf8f4"/>',
    '<g stroke="#3d3a34" stroke-width="2" fill="none">',
    '<g id="part-1" data-part="1"><circle cx="180" cy="150" r="52"/><circle cx="180" cy="150" r="20"/></g>',
    '<g id="part-2" data-part="2"><rect x="330" y="110" width="140" height="80" rx="6"/></g>',
    '<g id="part-3" data-part="3"><path d="M560 110h150v80h-150z"/><path d="M560 150h150"/></g>',
    '<g id="part-4" data-part="4"><path d="M140 300h120v90h-120z"/><path d="M170 300v90M230 300v90"/></g>',
    '<g id="part-5" data-part="5"><circle cx="410" cy="345" r="46"/><path d="M410 299v92M364 345h92"/></g>',
    '<g id="part-6" data-part="6"><path d="M570 300l70 45-70 45z"/></g>',
    '</g>',
    '<g font-family="system-ui,sans-serif" font-size="20" fill="#8a8274" text-anchor="middle">',
    '<text x="180" y="235">1</text><text x="400" y="235">2</text><text x="635" y="235">3</text>',
    '<text x="200" y="425">4</text><text x="410" y="425">5</text><text x="605" y="425">6</text>',
    '</g>',
    '</svg>',
].join('');

export async function loadSchematicSvg(url) {
    normalizeSchematicUrl(url);
    return FIXTURE_SVG;
}

export function useSchematicSvgLoader() {
    return {
        loadSchematicSvg,
    };
}
