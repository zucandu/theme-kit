/**
 * Banner store — the homepage and category banner slots.
 */
import { defineStore } from 'pinia';
import banners from '../../../fixtures/banners.json';

export const useBannerStore = defineStore('banner', {
    state: () => ({ banners: banners.banners ?? [] }),
    actions: {
        async fetchBanners() { return this.banners; },
    },
});
