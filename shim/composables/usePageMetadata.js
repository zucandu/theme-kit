/**
 * Page metadata (title, description).
 *
 * Sets the document title so a developer can tell pages apart in the browser
 * tab, and does nothing else. Canonical URLs, robots directives and OG tags
 * exist for crawlers, and nothing crawls localhost — emitting them here would
 * suggest the kit is verifying SEO output, which it is not.
 *
 * 🚨 `applyPageMetadata` is a NAMED export, not something the factory returns.
 * Product.vue and Manufacturer.vue import it directly. The surface extractor
 * only follows members reached through a factory call, so this one was invisible
 * to it and surfaced from an actual build instead — which is exactly why the
 * kit's own build must run against a real theme before a release.
 */
const setTitle = (meta = {}) => {
    const title = meta.metaTitle ?? meta.meta_title ?? meta.title ?? meta.name;
    if (title) document.title = title;
};

export function applyPageMetadata(meta) {
    setTitle(meta);
}

export function usePageMetadata() {
    return { setPageMetadata: setTitle, setMetadata: setTitle, applyMetadata: setTitle };
}
