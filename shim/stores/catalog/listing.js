/**
 * Listing store — category, manufacturer and search result pages.
 *
 * One captured page of results, handed over as-is. The slug and query params are
 * accepted and ignored: filtering and sorting are the platform's query work, and
 * a page of results is all a grid needs to be laid out.
 *
 * So: change a filter, tick a facet, jump to page 3 — the same products come
 * back. The controls are yours to style; what they select is not simulated.
 */
import { defineStore } from 'pinia';
import category from '../../../fixtures/category-listing.json';
import search from '../../../fixtures/search-result.json';

const pageOf = (fixture) => ({
    products: fixture.paginator.data,
    paginationLinks: fixture.paginator.links,
    paginationInfo: { from: fixture.paginator.from, to: fixture.paginator.to, total: fixture.paginator.total },
    filters: fixture.filters,
    object: fixture.object ?? {},
    ancestors: fixture.ancestors ?? [],
    subcategories: fixture.subcategories ?? [],
});

export const useListingStore = defineStore('listing', {
    state: () => pageOf(category),

    actions: {
        async fetchProductsByCategory() { Object.assign(this, pageOf(category)); },
        async fetchProductsByManufacturer() { Object.assign(this, pageOf(category)); },
        async fetchProductsByKeyword() { Object.assign(this, pageOf(search)); },
    },
});
