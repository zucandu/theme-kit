/**
 * Wishlist store.
 *
 * 🚨 A wishlist row is NOT a catalogue row, and seeding it with one is what
 * broke this page. The API returns a projection with its OWN `id` (the wishlist
 * entry) and a separate `product_id` (what it points at) — see
 * WishlistService::mapWishlistProducts. A theme keys everything off
 * `product_id`: the per-row quantity, add-to-cart, the restock modal and the
 * remove button all read it.
 *
 * Seeded straight from spotlight rows, every row's `product_id` was `undefined`,
 * and both halves of that failed at once:
 *
 *   - `rowState[item.product_id]` collapsed to a SINGLE shared entry, so typing
 *     a quantity into one row changed every row on the page.
 *   - `removeItem(item.product_id)` called `toggleProduct(undefined)`, which
 *     matched nothing, fell through to the "add" branch and pushed `undefined`
 *     into `items` — the next render then read `.id` off it and the page threw.
 *
 * The rest of the store mirrors the real one too, because the two are related:
 * `productIds` is its own array (that is what `count` and `isInWishlist` read,
 * not `items`), `toggleProduct` takes an ID and answers 'added' or 'removed',
 * and `shareUrl` is STATE that starts null rather than a getter that is always
 * set — a theme hides its "generate a new link" control until there is one.
 */
import { defineStore } from 'pinia';
import spotlight from '../../fixtures/product-spotlight.json';

const SHARE_TOKEN = 'theme-kit-demo-token';

/** The field set WishlistService projects, built from a catalogue row. */
const rowFrom = (product, index) => ({
    id: index + 1,
    product_id: product.id,
    sku: product.sku,
    price: product.price,
    sale_price: product.sale_price,
    quantity: product.quantity,
    status: product.status,
    type: product.type,
    translations: product.translations,
    // The API always sends at least one entry, using the placeholder name when a
    // product has no image — a theme branches on that string rather than on [].
    images: product.images?.length
        ? product.images.map(({ src }) => ({ src }))
        : [{ src: 'no-image.png' }],
    manufacturer: product.manufacturer ?? null,
    meta: product.meta,
    rating: product.rating,
    total_reviews: product.total_reviews,
    quantity_discount_status: product.quantity_discount_status,
    quantity_discounts: product.quantity_discounts ?? [],
    availability_date: product.availability_date,
    added_at: '2026-09-01 10:24:00',
});

const ROWS = (spotlight.new ?? []).slice(0, 3).map(rowFrom);

export const useWishlistStore = defineStore('wishlist', {
    state: () => ({
        items: [...ROWS],
        productIds: ROWS.map((row) => row.product_id),

        // False until a fetch answers, so the theme's loading branch is reachable.
        loaded: false,

        // Null until the shopper asks to share. A theme shows its "generate a new
        // link" control only once one exists; a getter that was always set meant
        // that control could never be seen in its absent state.
        shareToken: null,
        shareUrl: null,
    }),

    getters: {
        // Counts IDs, not rows. The two differ on a live store: the header badge
        // is fed by fetchWishlistIds(), which never loads the rows at all.
        count: (state) => state.productIds.length,

        isInWishlist: (state) => (productId) => state.productIds.includes(+productId),
    },

    actions: {
        async fetchWishlist() {
            this.items = [...ROWS];
            this.productIds = this.items.map((item) => item.product_id);
            this.loaded = true;
            return this.items;
        },

        async fetchWishlistIds() {
            this.productIds = ROWS.map((row) => row.product_id);
            this.loaded = true;
            return this.productIds;
        },

        /**
         * Add or remove one product, by ID, answering which happened.
         *
         * 🚨 It takes an ID — never a product object. The heart on a product card
         * and the remove button on this page both pass `product_id`, and the
         * return value is what a theme toasts ("Added to wishlist" vs "Removed").
         *
         * A product the fixtures do not carry is still TRACKED in `productIds`,
         * so its heart fills, but adds no row: a row invented here would be a
         * shape nothing else in the kit agrees with, and pushing a value that is
         * not a row is the exact bug this file is fixing.
         */
        async toggleProduct(productId) {
            const id = +productId;
            const at = this.productIds.indexOf(id);

            if (at === -1) {
                const row = ROWS.find((candidate) => candidate.product_id === id);
                if (row) this.items.push(row);
                this.productIds.push(id);
                return 'added';
            }

            this.productIds.splice(at, 1);
            this.items = this.items.filter((item) => item.product_id !== id);
            return 'removed';
        },

        async removeProduct(productId) {
            return this.toggleProduct(productId);
        },

        async clearAll() {
            this.items = [];
            this.productIds = [];
        },

        /**
         * Mint the public link, in the shape the theme destructures.
         *
         * 🚨 `share_url`, not `url`. The theme does
         * `const { share_url } = await shareWishlist(...)` and copies it to the
         * clipboard — the old key put the string "undefined" on the clipboard
         * and reported success.
         */
        async shareWishlist(regenerate = false) {
            this.shareToken = regenerate
                ? `${SHARE_TOKEN}-${Date.now().toString(36)}`
                : SHARE_TOKEN;
            this.shareUrl = `${window.location.origin}/wishlist/shared/${this.shareToken}`;

            return { share_token: this.shareToken, share_url: this.shareUrl };
        },

        reset() {
            this.items = [];
            this.productIds = [];
            this.loaded = false;
            this.shareToken = null;
            this.shareUrl = null;
        },
    },
});
