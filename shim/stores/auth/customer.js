/**
 * Customer auth.
 *
 * You start SIGNED OUT, and that is the point. A kit that forced you to be
 * logged in would hide the login form, the register form, the guest header and
 * every "sign in to continue" branch — a large part of what a theme has to get
 * right, and the part a developer would never think to check.
 *
 * Signing in accepts ANYTHING. Type any email and any password and you are in,
 * with the dummy profile from customer.json. Whether a credential is valid is a
 * store's decision, and there is no store here.
 *
 * The session is remembered in localStorage under the same key the platform
 * uses, so a reload keeps you signed in and the logout page really signs you
 * out. Both states stay one click apart.
 */
import { defineStore } from 'pinia';
import fixture from '../../../fixtures/customer.json';

const TOKEN_KEY = 'jwt_customer';
const CUSTOMER = fixture.customer;

export const useAuthCustomerStore = defineStore('authCustomer', {
    state: () => {
        const signedIn = !!localStorage.getItem(TOKEN_KEY);
        return {
            signedIn,
            customerInfo: signedIn ? CUSTOMER : null,
            profile: signedIn ? CUSTOMER : null,
        };
    },

    getters: {
        isLoggedIn: (state) => state.signedIn,
        isGuest: (state) => !state.signedIn,
        isRegisteredCustomer: (state) => state.signedIn,

        customerAddresses: (state) => state.customerInfo?.addresses ?? [],
        customerAddressTotal: (state) => (state.customerInfo?.addresses ?? []).length,
        customerShippingAddress: (state) => state.customerInfo?.addresses?.[0],
        customerBillingAddress: (state) => state.customerInfo?.addresses?.[1],
    },

    actions: {
        signIn() {
            localStorage.setItem(TOKEN_KEY, 'theme-kit-offline');
            this.signedIn = true;
            this.customerInfo = CUSTOMER;
            this.profile = CUSTOMER;
        },

        clearCustomerAuth() {
            localStorage.removeItem(TOKEN_KEY);
            this.signedIn = false;
            this.customerInfo = null;
            this.profile = null;
        },

        /** Any credentials are accepted. Login.vue then calls fetchCustomerInfo(). */
        async loginCustomer() {
            this.signIn();
            return { token: 'theme-kit-offline', profile: CUSTOMER };
        },

        async registerCustomer() {
            this.signIn();
            return { token: 'theme-kit-offline', profile: CUSTOMER };
        },

        async upgradeGuestToAccount() {
            this.signIn();
            return { data: {} };
        },

        /**
         * Storefront.vue calls this on every page load, for guests too, so it must
         * NOT sign anyone in — it only reports who is already signed in.
         */
        async fetchCustomerInfo() {
            this.customerInfo = this.signedIn ? CUSTOMER : null;
            return this.customerInfo;
        },

        async resetCustomerPassword() { return { data: {} }; },
        async updateCustomerPassword() { return { data: {} }; },
        async updateAccountPassword() { return { data: {} }; },
        async updateCustomerProfile() { return { data: {} }; },
        async subscribeNewsletter() { return { data: {} }; },
        async unsubscribeNewsletter() { return { data: {} }; },

        async createCustomerAddress() { return { data: {} }; },
        async updateCustomerAddress() { return { data: {} }; },
        async deleteCustomerAddress() { return { data: {} }; },
    },
});
