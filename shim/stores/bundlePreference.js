/**
 * Bundle preferences — a shopper's saved choice per bundle group.
 *
 * 🚨 The member names here are the ones the theme actually calls: available,
 * load, save, forget, isAppliedFor, resolveFor. They have to come from the call
 * sites, never from a guess at what a store "probably" exposes.
 *
 * Kept in memory rather than answered with a constant, because a frozen
 * `available: false` hid the whole second half of the bundle UI — the remember
 * control, the "saved preference" notice, the forget path — and a developer had
 * no way to style any of it. Nothing survives a reload; there is no account
 * endpoint behind this.
 *
 * `null` is a real saved answer meaning "Not needed", and is not the same as the
 * key being absent.
 */
import { defineStore } from 'pinia';

import { useAuthCustomerStore } from './auth/customer';

export const useBundlePreferenceStore = defineStore('bundlePreference', {
    state: () => ({
        preferences: {}, // { [preference_key]: option_product_id | null }
        loaded: true,
        loading: null,
    }),

    getters: {
        // Guests see no control at all — sign in to reach that half of the UI.
        available() {
            const auth = useAuthCustomerStore();
            return !!auth.isLoggedIn && !auth.isGuest;
        },
    },

    actions: {
        async load() {
            return this.preferences;
        },

        async save(key, optionProductId) {
            if (!this.available || !key) return false;
            this.preferences = { ...this.preferences, [key]: optionProductId ?? null };
            return true;
        },

        async forget(key) {
            if (!this.available || !key) return false;
            const { [key]: _gone, ...rest } = this.preferences;
            this.preferences = rest;
            return true;
        },

        /** Is this group showing the saved choice? Derived, never stored. */
        isAppliedFor(group, current = {}) {
            const key = group?.preference_key;
            if (!this.available || !key || !(key in this.preferences)) return false;
            if (!(group.id in current)) return false;

            const saved = this.preferences[key];
            const chosen = current[group.id];

            return saved === null || chosen === null
                ? saved === null && chosen === null
                : Number(saved) === Number(chosen);
        },

        /**
         * Fill in the groups the shopper has not answered yet.
         *
         * Whatever is already on the form wins, and a saved option is only used
         * while the group still offers it — preselecting something that is gone
         * is the failure this feature exists to avoid.
         */
        resolveFor(bundleGroups, current = {}) {
            const selections = { ...current };
            const applied = {};

            if (!this.available) return { selections, applied };

            for (const group of bundleGroups || []) {
                const key = group?.preference_key;
                if (!key || !(key in this.preferences) || group.id in selections) continue;

                const saved = this.preferences[key];
                const offered = saved === null
                    || (group.options || []).some((o) => Number(o.option_product_id) === Number(saved));

                if (offered) {
                    selections[group.id] = saved;
                    applied[group.id] = key;
                }
            }

            return { selections, applied };
        },
    },
});
