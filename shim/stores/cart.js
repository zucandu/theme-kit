/**
 * Cart store.
 *
 * State is a ready-made cart from cart.json. Totals are FROZEN NUMBERS, not a
 * running sum: a live store recalculates them server-side against its own
 * discount, shipping and tax rules, so a total that moved here would only ever
 * be a different wrong answer.
 *
 * What that means when you design against it: change a quantity and the line
 * updates, but the subtotal stays put. That is expected, not a bug.
 *
 * Adding still adds the product you clicked. That one thing is kept honest on
 * purpose — wiring add-to-cart to the wrong product is a common theme bug, and
 * if the cart always showed the same item you could not tell your bug from this
 * file's placeholder.
 */
import { defineStore } from 'pinia';
import cart from '../../fixtures/cart.json';
import checkout from '../../fixtures/checkout.json';

export const useCartStore = defineStore('cart', {
    state: () => ({
        items: [...cart.items],
        subtotal: cart.subtotal,
        item_count: cart.item_count,
        loaded: true,
    }),

    getters: {
        numberOfItems: (state) => state.items.length,
        hasOutOfStock: () => false,
        hasMaxQty: () => false,
    },

    actions: {
        async init() {},

        async addProduct(product) {
            this.items.push({ ...product, qty: 1, inventory: 99, max_qty: 0, meta: {} });
        },

        async addBookingProduct(product) {
            this.items.push({ ...product, qty: 1, inventory: 99, max_qty: 0, meta: {} });
        },

        async updateQuantity(item, qty) {
            const line = this.items.find((i) => i.id === (item?.id ?? item));
            if (line) line.qty = qty;
        },

        async removeProduct(item) {
            this.items = this.items.filter((i) => i.id !== (item?.id ?? item));
        },

        /**
         * 🚨 Returns an ARRAY of shipping GROUPS, each with its own `methods[]` —
         * not a single `{ methods }` object. That is the shape a live store
         * quotes back, and a theme flattens it:
         * `groups.flatMap((g) => g.methods)`. Returning the object form here threw
         * `flatMap is not a function` inside a computed, which surfaces only as a
         * caught console error and an estimator stuck on "calculating".
         *
         * Two groups, one of them free, because a rate list with a single row
         * hides every layout decision the real one forces: which is selected,
         * how a zero cost prints, how two groups stack.
         *
         * The quote ignores the address it is given. A live store prices against
         * the merchant's own zones and rules; guessing at them here would produce
         * a number that is wrong in a more convincing way.
         */
        async calculateShippingEstimate() { return checkout.shipping_methods; },

        reset() { this.items = []; },
    },
});
