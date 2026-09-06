/**
 * Product store.
 *
 * Everything here hands back a fixture or a fixed value. Nothing is derived at
 * runtime — the variant map was reshaped once, offline, and saved as
 * product-variants.json, so this file only has to return it.
 *
 * What that means when you design against it:
 *
 *  - prices come straight off the product row; the currency switcher changes the
 *    symbol, not the number
 *  - `tax` is always 0 — a live store puts a real figure there, so never lay out
 *    assuming the tax row takes no space
 *  - variant selection IS real: the fixture parent has three children on one
 *    axis, so the picker moves price, SKU and stock. What stays frozen is the
 *    cart total, not the product
 */
import { defineStore } from 'pinia';

import productDetails from '../../../fixtures/product-details.json';
import variantFixture from '../../../fixtures/product-variants.json';
import spotlight from '../../../fixtures/product-spotlight.json';
import reviews from '../../../fixtures/product-reviews.json';
import crossSells from '../../../fixtures/product-cross-sells.json';
import upSells from '../../../fixtures/product-up-sells.json';
import adjacent from '../../../fixtures/product-adjacent.json';

const CHILDREN = productDetails.product.children ?? [];

/**
 * Size option value -> the child product it selects.
 *
 * Written out rather than worked out. The fixture parent offers one axis with
 * three values, so three lines say it completely, and every selection moves
 * price, SKU and stock the way a real picker does.
 *
 * Swap a fixture in and this is the one place to re-point.
 */
const CHILD_BY_OPTION_VALUE = {
    95: CHILDREN[0],
    96: CHILDREN[1],
    97: CHILDREN[2],
};

export const useProductStore = defineStore('product', {
    state: () => ({
        productDetails: {},
        adjacentProducts: adjacent,
    }),

    getters: {
        finalizeProductPrice: () => (product) => ({
            retail: product.price,
            sale: product.sale_price,
            final: product.sale_price || product.price,
            tax: 0,
        }),

        priceFormat: () => (price) => price,

        getVariants: () => variantFixture.variants,

        // The theme only ever asks for 'readonly' here (the spec table); the
        // variant axes come through getVariants above.
        getAttributes: () => () => variantFixture.readonly,

        /**
         * Which child product a variant selection resolves to.
         *
         * A lookup, not a match: the table below is the whole rule, so there is
         * no selection logic here to drift from a real store's.
         *
         * 🚨 The two guards are the load-bearing part. This used to return a
         * child unconditionally, including before anything had loaded — and a
         * theme that watches the resolved product id then fires its first
         * callback against a truthy id while `productDetails` is still the empty
         * `{}` this store starts as. Any `productDetails.children` read in that
         * callback throws. Nothing like it happens on a live store, where an
         * empty product or an empty selection both give back `undefined` and the
         * theme's own `if (!id)` short-circuit holds. A kit that invents a crash
         * the store does not have is worse than one that renders nothing.
         */
        childProduct: () => (product, selectedAtt) => {
            if (!product || Object.keys(product).length === 0) return undefined;

            const [selectedValue] = Object.values(selectedAtt ?? {});
            if (selectedValue === undefined) return undefined;

            // An option the fixture has no child for is a combination the
            // merchant never created. That state needs designing too, so it is
            // not smoothed over into a buyable product.
            return CHILD_BY_OPTION_VALUE[selectedValue] ?? { ...product, quantity: 0, status: 0 };
        },
    },

    actions: {
        async retrieveProductDetails() {
            this.productDetails = productDetails.product;
            return productDetails.product;
        },

        async fetchSpotlightProducts() { return spotlight; },
        async fetchLatestReviews() { return reviews; },
        async fetchCrossSells() { return crossSells; },
        async fetchUpSells() { return upSells; },
        async fetchAdjacentProducts() { return adjacent; },
        async addReview() { return { data: {} }; },
    },
});
