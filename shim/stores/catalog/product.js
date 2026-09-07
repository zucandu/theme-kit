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
import simpleDetails from '../../../fixtures/product-details-simple.json';
import bundleDetails from '../../../fixtures/product-details-bundle.json';
import bookingDetails from '../../../fixtures/product-details-booking.json';
import variantFixture from '../../../fixtures/product-variants.json';
import spotlight from '../../../fixtures/product-spotlight.json';
import reviews from '../../../fixtures/product-reviews.json';
import crossSells from '../../../fixtures/product-cross-sells.json';
import upSells from '../../../fixtures/product-up-sells.json';
import adjacent from '../../../fixtures/product-adjacent.json';

const CHILDREN = productDetails.product.children ?? [];

/** Read off the fixture rather than hardcoded, so a recapture cannot desync it. */
const slugOf = (fixture) => fixture.product.translations?.find((t) => t?.slug)?.slug ?? null;

/**
 * Which captured product a slug answers with.
 *
 * Four products, because a theme lays each of them out differently and three of
 * the four have a whole section of the page that the others do not:
 *
 *   simple       no picker, straight to add-to-cart
 *   configurable the variant axes
 *   bundle       `bundle_groups` — the accessory radios above add-to-cart
 *   booking      the date/room/notes picker and no qty stepper
 *
 * Built from the fixtures rather than written out, so a recapture that lands on
 * a different product cannot leave a dead slug behind.
 */
const BY_SLUG = new Map([
    [slugOf(simpleDetails), simpleDetails.product],
    [slugOf(bundleDetails), bundleDetails.product],
    [slugOf(bookingDetails), bookingDetails.product],
].filter(([slug]) => slug));

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

        /**
         * The variant axes, but ONLY for the product they were derived from.
         *
         * 🚨 This used to hand back the same map for whatever was loaded, and the
         * result was a phantom picker: the simple product and the bundle product
         * both offered "Size: Samsung Galaxy S20 / S20 Plus / S20 Ultra", three
         * options belonging to a phone case two products away. Neither product
         * has a single attribute — `attributes` is `[]` on both — so the simple
         * layout the kit captured a fixture specifically to show could never
         * actually be looked at, and picking an axis moved a price that was not
         * the product's.
         *
         * The platform derives this per product (`getAttributes(productDetails,
         * 'select')`), so an empty answer for a product with no select attributes
         * is what a live store gives, not a shortcut.
         */
        getVariants: (state) => (
            state.productDetails?.id === variantFixture._source_product_id
                ? variantFixture.variants
                : []
        ),

        // The theme only ever asks for 'readonly' here (the spec table); the
        // variant axes come through getVariants above. Gated the same way, for
        // the same reason — a spec table is as wrong on the wrong product.
        getAttributes: (state) => () => (
            state.productDetails?.id === variantFixture._source_product_id
                ? variantFixture.readonly
                : []
        ),

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
        /**
         * The slug DECIDES which of the four captured products answers.
         *
         * 🚨 This used to ignore its argument and always hand back the
         * configurable product, so a theme's SIMPLE-product layout — no variant
         * picker, no option axis, straight to add-to-cart — could not be reached
         * from any URL. That is not a small corner: it is the shape most of a
         * real catalogue is in, and the pages lay out very differently.
         *
         * The bundle and booking fixtures are here for the same reason: their
         * sections of the product page are unreachable without a product that
         * carries them, and neither is something a theme can be trusted to have
         * been designed for sight unseen. The nav's Product Types dropdown links
         * straight to all four.
         *
         * Every other slug still resolves to the configurable product, as before:
         * a catalogue whose every other row 404s would make the listing pages
         * useless.
         */
        async retrieveProductDetails(slug) {
            const product = BY_SLUG.get(slug) ?? productDetails.product;

            this.productDetails = product;
            return product;
        },

        async fetchSpotlightProducts() { return spotlight; },
        async fetchLatestReviews() { return reviews; },
        async fetchCrossSells() { return crossSells; },
        async fetchUpSells() { return upSells; },
        async fetchAdjacentProducts() { return adjacent; },
        async addReview() { return { data: {} }; },
    },
});
