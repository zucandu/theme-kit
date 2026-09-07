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
import { announce } from '../services/announce.js';
import cart from '../../fixtures/cart.json';
import checkout from '../../fixtures/checkout.json';
import spotlight from '../../fixtures/product-spotlight.json';
import search from '../../fixtures/search-result.json';
import productDetails from '../../fixtures/product-details.json';
import simpleDetails from '../../fixtures/product-details-simple.json';

/**
 * Every product the fixtures know about, by id.
 *
 * 🚨 A theme posts only `{ id, cart_quantity }` when it adds to the cart — the
 * name, price, image and slug come back from the SERVER, in the cart summary the
 * response carries. The kit has no server, so a row pushed from the payload alone
 * rendered as "$0.00", no title, no image and a link to `/product/undefined`.
 * Add-to-cart could not be laid out at all, which is the one behaviour this
 * store's own notes promise to keep honest.
 *
 * Looking the product up here is the kit's stand-in for that summary.
 */
const CATALOGUE = new Map();
for (const row of [
    ...Object.values(spotlight).flat(),
    ...(search.paginator?.data ?? []),
    productDetails.product,
    ...(productDetails.product.children ?? []),
    simpleDetails.product,
]) {
    if (row && row.id != null && !CATALOGUE.has(row.id)) CATALOGUE.set(row.id, row);
}

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

        /**
         * 🚨 Every cart action takes ONE object, the payload the theme posts, and
         * the quantity inside it is called `cart_quantity`. Reading it as a second
         * argument — `updateQuantity(item, qty)` — left `qty` undefined on every
         * call, so the stepper blanked the quantity input instead of changing it
         * and the line never moved. `addProduct` had the same fault in a quieter
         * form: it hardcoded `qty: 1`, so asking for three added one.
         *
         * A live store answers these with a whole new cart summary; the kit edits
         * the line in place, which is the same visible outcome for a theme.
         */
        async addProduct(payload) {
            this.addLine(payload);
            announce('Add to cart');
        },

        async addBookingProduct(payload) {
            this.addLine(payload);
            announce('Add booking to cart');
        },

        /**
         * Adding a product already in the cart RAISES that line rather than
         * adding a second one. A store returns a merged summary, so a theme that
         * duplicated a row would be laying out against something it never sees.
         */
        addLine(payload) {
            const id = payload?.id;
            const qty = Math.max(1, +payload?.cart_quantity || 1);
            const existing = this.items.find((line) => line.id === id);

            if (existing) {
                existing.qty = +existing.qty + qty;
                return;
            }

            // The catalogue row first, so a real product brings its name, price,
            // images and slug; the payload last, so anything the theme sent
            // deliberately (bundle selections, booking fields) still wins.
            const product = CATALOGUE.get(id) ?? {};

            this.items.push({
                ...product,
                ...payload,
                id,
                qty,
                inventory: +product.quantity || 99,
                max_qty: +product.max_quantity || 0,
                meta: payload?.meta ?? product.meta ?? {},
            });
        },

        async updateQuantity(formdata) {
            const line = this.items.find((i) => i.id === formdata?.id);
            if (!line) return;

            const qty = +formdata?.cart_quantity;
            if (Number.isFinite(qty) && qty > 0) line.qty = qty;
        },

        async removeProduct(item) {
            this.items = this.items.filter((i) => i.id !== (item?.id ?? item));
            announce('Remove from cart');
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
