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

        async calculateShippingEstimate() { return { methods: [] }; },

        reset() { this.items = []; },
    },
});
