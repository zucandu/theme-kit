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
 *  - every variant selection resolves to the SAME child product; the picker
 *    responds and can be styled, but it is not really choosing anything
 */
import { defineStore } from 'pinia';

import productDetails from '../../../fixtures/product-details.json';
import variantFixture from '../../../fixtures/product-variants.json';
import spotlight from '../../../fixtures/product-spotlight.json';
import reviews from '../../../fixtures/product-reviews.json';
import crossSells from '../../../fixtures/product-cross-sells.json';
import upSells from '../../../fixtures/product-up-sells.json';
import adjacent from '../../../fixtures/product-adjacent.json';

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
        childProduct: () => () => variantFixture.child,
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
