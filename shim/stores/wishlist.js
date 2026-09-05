/**
 * Wishlist store.
 *
 * Seeded from real catalogue rows so the wishlist page has cards to lay out.
 * Toggling adds or removes the product you clicked, so the heart icon responds.
 * Nothing persists past a reload.
 */
import { defineStore } from 'pinia';
import spotlight from '../../fixtures/product-spotlight.json';

const ROWS = spotlight.new ?? [];

export const useWishlistStore = defineStore('wishlist', {
    state: () => ({ items: ROWS.slice(0, 3), loaded: true }),

    getters: {
        count: (state) => state.items.length,
        isInWishlist: (state) => (id) => state.items.some((p) => +p.id === +id),
        shareUrl: () => '/wishlist/shared/theme-kit-demo-token',
    },

    actions: {
        async fetchWishlist() { return this.items; },
        async fetchWishlistIds() { return this.items.map((p) => p.id); },

        async toggleProduct(product) {
            const id = product?.id ?? product;
            const at = this.items.findIndex((p) => +p.id === +id);
            if (at >= 0) this.items.splice(at, 1);
            else this.items.push(product);
        },

        async clearAll() { this.items = []; },
        async shareWishlist() { return { url: this.shareUrl }; },
    },
});
