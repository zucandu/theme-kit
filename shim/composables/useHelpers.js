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

    return {
        basicCompare: (a, b) => (a < b ? -1 : a > b ? 1 : 0),

        // Intl does the symbol, so 'USD' renders as $ rather than the letters.
        // Not a rule of the platform's - it is the browser's own formatter.
        formatCurrency: (price, decimal = 2, currency = null) => {
            const n = Number(price);
            if (Number.isNaN(n)) return '___';
            return currency
                ? n.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: decimal })
                : n.toFixed(decimal);
        },

        translateItemObj: (item) => firstTranslation(item),
        translateItemField: (item, field) => firstTranslation(item)?.[field],

        buildPath: (link, slug) => `/${link}/${slug ?? ''}`.replace(/\/+/g, '/'),
        parseMenuLink: (item, field) => {
            const slug = firstTranslation(item)?.[field] ?? '';
            return item.link === 'page' || item.link === 'banner' ? `/${slug}` : `/${item.link}/${slug}`;
        },

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
