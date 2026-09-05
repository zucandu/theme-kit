/**
 * Bundle preferences — a shopper's saved choices for bundle groups.
 *
 * 🚨 The member names here are the ones the theme actually calls: available,
 * load, save, forget, isAppliedFor, resolveFor. An earlier draft of this file
 * invented a different set and would have thrown the moment a bundle product
 * rendered — the names have to come from the call sites, never from a guess at
 * what a store "probably" exposes.
 *
 * Every answer is fixed: nothing is applied, nothing resolves. The bundle UI
 * renders in its untouched state, which is enough to lay it out.
 */
import { defineStore } from 'pinia';

export const useBundlePreferenceStore = defineStore('bundlePreference', {
    state: () => ({
        preferences: {},
        loaded: true,
        loading: null,
    }),

    getters: {
        available: () => false,
    },

    actions: {
        async load() {},
        async save() {},
        async forget() {},

        isAppliedFor: () => false,
        resolveFor: () => ({}),
    },
});
