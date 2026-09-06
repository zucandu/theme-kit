/**
 * Presentation helpers.
 *
 * Deliberately the simplest thing that renders. The platform's versions do more
 * — locale-aware number formatting, custom date patterns, config-driven grid
 * columns — and none of that is reproduced here. What you get instead:
 *
 *  - text comes from the first translation on an item, whatever the locale
 *  - money is a fixed-decimal number with the currency code in front
 *  - dates are ISO, whatever format string you pass
 *  - the product grid is a fixed 2/4 column layout, ignoring store config
 *
 * They exist only so the storefront reads as words and numbers rather than
 * blanks while you lay it out. Judge spacing and hierarchy here; judge
 * formatting on a real store.
 */
const GRID_CLASSES = 'grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4';

export function useHelpers() {
    const firstTranslation = (item) => item?.translations?.[0];

    /**
     * Turn a menu row's `link` + slug into a path.
     *
     * 🚨 Both rules here are load-bearing, and the shortcut version had neither.
     *
     * Leading slashes come off the slug first. A menu row whose url is stored as
     * `/` — which is how "Home" is stored — otherwise produced `//`, because the
     * separator is added again below. `//` is a protocol-relative URL, so the
     * nav's own Home link pointed off-origin.
     *
     * `_` in the link becomes `/`, so a `track_order` row addresses
     * `/track/order/...` and not `/track_order/...`. Getting this wrong sends a
     * theme's menu to a route that exists nowhere.
     */
    const buildPath = (link, slug) => {
        const cleanSlug = slug?.replace(/^\/+/, '') || '';
        if (['page', 'banner'].includes(link)) return `/${cleanSlug}`;

        return `/${String(link).replace(/_/g, '/')}/${cleanSlug}`;
    };

    return {
        basicCompare: (a, b) => (a < b ? -1 : a > b ? 1 : 0),

        // Intl does the symbol, so 'USD' renders as $ rather than the letters.
        // Not a rule of the platform's - it is the browser's own formatter.
        /**
         * Formats exactly as a live store does, and it has to.
         *
         * 🚨 The no-currency branch used to be `n.toFixed(decimal)`, which drops
         * the thousands separator: `formatCurrency(1234.5)` printed `1234.50`
         * here and `1,234.50` on a store. Prices are laid out to a width, so a
         * theme checked against the short form has its column measured wrong for
         * every four-figure total — and nothing in the console says so, because
         * both strings are perfectly valid numbers.
         *
         * `maximumFractionDigits` is set alongside the minimum for the same
         * reason: without it a value with more decimals than asked for keeps
         * them, and `locale` is a real fourth parameter, not decoration.
         */
        formatCurrency: (price, decimal = 2, currency = null, locale = 'en-US') => {
            if (isNaN(price)) return '___';

            const options = {
                minimumFractionDigits: decimal,
                maximumFractionDigits: decimal,
            };

            if (currency) {
                options.style = 'currency';
                options.currency = currency;
            }

            return new Intl.NumberFormat(locale, options).format(price);
        },

        translateItemObj: (item) => firstTranslation(item),
        translateItemField: (item, field) => firstTranslation(item)?.[field],

        buildPath,
        parseMenuLink: (item, field) => buildPath(item?.link, firstTranslation(item)?.[field]),

        // Reads the real address bar, because listing filters and search put their
        // state there and a theme's filter chips have to reflect it.
        getUrlParams: (excluding = []) => {
            const out = {};
            for (const [key, value] of new URLSearchParams(window.location.search)) {
                if (!excluding.includes(key)) out[key] = value;
            }
            return out;
        },
        getUrlParam: (url, name) => (url ? new URL(url).searchParams.get(name) : undefined),

        isEmpty: () => (value) => value === null || value === undefined || value === '',

        getGridClasses: () => GRID_CLASSES,
        formatWeight: (value) => (value == null ? '' : String(value)),
        formatDate: (value) => (value ? String(value).slice(0, 10) : ''),
    };
}
