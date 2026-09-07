/**
 * Bundle preferences — a shopper's saved choices for bundle groups.
 *
 * 🚨 The member names here are the ones the theme actually calls: available,
 * load, save, forget, isAppliedFor, resolveFor. An earlier draft of this file
 * invented a different set and would have thrown the moment a bundle product
 * rendered — the names have to come from the call sites, never from a guess at
 * what a store "probably" exposes.
 *
 * Preferences are kept IN MEMORY here rather than answered with a constant.
 * They used to be frozen — `available: false`, `save`/`forget` no-ops — and
 * that hid the whole second half of BundleGroupSelector: the "remember this
 * choice" control, the "using your saved choice" notice, and the forget path.
 * A theme developer had no way to see, let alone style, any of it. Holding the
 * map in the store is not an invention: a saved preference is client-visible
 * state, and the precedence rules below are the platform's own, copied so the
 * kit cannot drift from what a live store decides.
 *
 * What is NOT real is persistence — nothing survives a reload, because there is
 * no account endpoint behind this.
 */
import { defineStore } from 'pinia';

import { useAuthCustomerStore } from './auth/customer';

export const useBundlePreferenceStore = defineStore('bundlePreference', {
    state: () => ({
        // { [preference_key]: { option_product_id: number|null, updated_at: string } }
        // `option_product_id: null` is an explicit "Not needed" — a different
        // answer from the key being absent, which means no preference at all.
        preferences: {},
        loaded: true,
        loading: null,
    }),

    getters: {
        /**
         * Guests see no controls at all — not a disabled control hinting at
         * something they cannot use. Signing out in the kit hides them, which is
         * the state to check the guest layout against.
         */
        available() {
            const auth = useAuthCustomerStore();
            return !!auth.isLoggedIn && !auth.isGuest;
        },
    },

    actions: {
        async load() {
            return this.preferences;
        },

        async save(preferenceKey, optionProductId) {
            if (!this.available || !preferenceKey) return false;

            this.preferences = {
                ...this.preferences,
                [preferenceKey]: {
                    option_product_id: optionProductId ?? null,
                    updated_at: new Date().toISOString(),
                },
            };

            return true;
        },

        async forget(preferenceKey) {
            if (!this.available || !preferenceKey) return false;

            const { [preferenceKey]: _dropped, ...rest } = this.preferences;
            this.preferences = rest;

            return true;
        },

        /** Is this group's current value the one the customer saved? */
        isAppliedFor(group, current = {}) {
            const key = group?.preference_key;

            if (!this.available || !key || !(key in this.preferences)) return false;
            if (!(group.id in current)) return false;

            const saved = this.preferences[key].option_product_id;
            const chosen = current[group.id];

            // Both null is an explicit "Not needed" on both sides — a match.
            if (saved === null || chosen === null) return saved === null && chosen === null;

            return Number(saved) === Number(chosen);
        },

        /**
         * Which groups a saved preference fills in, given what is already picked.
         *
         * Precedence, highest first: the live form selection, then a compatible
         * saved preference, then nothing. A preference is applied ONLY when the
         * group still offers it — substituting a different option for a stale one
         * is the failure this feature exists to avoid.
         */
        resolveFor(bundleGroups, current = {}) {
            const selections = { ...current };
            const applied = {};

            if (!this.available) return { selections, applied };

            for (const group of bundleGroups || []) {
                const key = group?.preference_key;
                if (!key || !(key in this.preferences)) continue;
                if (group.id in selections) continue;

                const saved = this.preferences[key].option_product_id;

                if (saved === null) {
                    // An explicit "Not needed" needs no option to still exist.
                    selections[group.id] = null;
                    applied[group.id] = key;
                    continue;
                }

                const stillOffered = (group.options || [])
                    .some((option) => Number(option.option_product_id) === Number(saved));

                if (stillOffered) {
                    selections[group.id] = saved;
                    applied[group.id] = key;
                }
            }

            return { selections, applied };
        },
    },
});
