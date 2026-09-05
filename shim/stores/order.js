/**
 * Order & checkout store.
 *
 * Method lists are the JSON a store's own modules return. Shipping is the
 * quote shape a shipping module produces; payment is Check/Money Order, chosen
 * because it is the one module with no gateway, no API keys and no redirect —
 * the honest default for a kit that never contacts anything.
 *
 * Every total is a FIXED NUMBER. Nothing is summed, and picking a different
 * shipping method does not move the figure.
 *
 * 🚨 A live store differs in ways a theme has to survive:
 *   - both method lists come from installed modules and can be EMPTY
 *   - tax is a real number; the tax row is not zero-width
 *   - a coupon actually changes the total
 */
import { defineStore } from 'pinia';
import checkout from '../../fixtures/checkout.json';
import orderFixture from '../../fixtures/order.json';
import customer from '../../fixtures/customer.json';

const ORDER = orderFixture.order;
const ADDRESSES = customer.customer.addresses;

export const useOrderStore = defineStore('order', {
    state: () => ({
        orderRef: ORDER.reference,

        // State, not an action: the theme calls fetchOrderDetailsByRef() and then
        // reads `orderStore.retrieveOrder`.
        retrieveOrder: null,

        prefilledAddress: null,
        checkoutDraftId: 'theme-kit-draft',

        checkoutShippingMethods: checkout.shipping_methods,
        checkoutPaymentMethods: checkout.payment_methods,
        checkoutDiscountModules: checkout.discount_modules,

        checkoutSelections: {
            shipping: checkout.shipping_methods[0].methods[0],
            payment: checkout.payment_methods[0],
            promotions: {},
            // Empty until a coupon is applied, so the coupon field opens as a field.
            discounts: [],
            comments: {},
        },
    }),

    getters: {
        // Reads the cost off the method the shopper picked. Not a calculation - the
        // number is already on the selected object - but it has to be READ rather
        // than frozen: choosing Free Shipping while $9.95 stays on screen makes the
        // whole panel look broken.
        checkoutShippingCost: (state) => +state.checkoutSelections.shipping?.cost || 0,
        // A real figure, not zero: it is the rate on the default shipping address
        // in customer.json. Kept non-zero on purpose so the Sales Tax row renders
        // and gets designed - it is hidden below zero, and a theme that never saw
        // it would ship the row unstyled.
        checkoutTaxAmount: () => checkout.totals.tax,
        /**
         * The checkout reads a lot off this one object, and two keys are easy to
         * get wrong: `shipping` and `billing` are ADDRESSES, while the chosen
         * delivery option lives under `shippingmethod`.
         *
         * `total` is added up from the lines the summary already shows. It is the
         * one sum in the kit, and it earns its place: a total that contradicts the
         * rows above it reads as a bug in the theme's own template. Everything it
         * adds is either fixed or a value the shopper just selected — no pricing
         * rule is reproduced here.
         */
        /**
         * Always true. The platform gates checkout on live stock, and judging a
         * frozen fixture would return one verdict forever.
         *
         * 🚨 Load-bearing. Checkout.vue reads it on mount and, when it is falsy,
         * toasts `checkoutBlockedReason` and sends the shopper back to the cart —
         * so dropping this getter does not surface as an error, it just makes
         * /checkout silently bounce to /cart.
         */
        readyToCheckout: () => true,
        checkoutBlockedReason: () => '',

        checkoutParams(state) {
            const discount = state.checkoutSelections.discounts
                .reduce((sum, d) => sum + (+d?.details?.amount || 0), 0);

            return {
                ...ORDER,
                ...checkout.totals,
                discount,
                shippingcost: this.checkoutShippingCost,
                total: checkout.totals.subtotal + this.checkoutShippingCost + this.checkoutTaxAmount - discount,
                shipping: ADDRESSES[0],
                billing: ADDRESSES[1],
                shippingmethod: state.checkoutSelections.shipping,
                paymentmethod: state.checkoutSelections.payment,
            };
        },
    },

    actions: {
        setCheckoutSelections(selections) {
            this.checkoutSelections = { ...this.checkoutSelections, ...selections };
        },

        prefillAddress(address) {
            this.prefilledAddress = address ?? null;
        },

        async initializeCheckout() { return { draft_id: this.checkoutDraftId }; },

        // Return shapes follow the theme's own call sites: the order list reads
        // `res.orders`, PaymentRequest reads `res.data.payment_request`, and the
        // verify form reads `verified.ref`.
        async retrieveCustomerOrders() { return { orders: [ORDER] }; },

        async fetchOrderDetailsByRef() {
            this.retrieveOrder = ORDER;
            return ORDER;
        },

        async fetchTrackingDetailsByRef() {
            this.retrieveOrder = ORDER;
            return { order: ORDER, tracking: [], histories: ORDER.histories };
        },

        async getPaymentRequest() {
            return { data: { payment_request: { order_id: ORDER.id, reference: ORDER.reference, amount: ORDER.order_total } } };
        },

        async verify() { return { verified: true, ref: ORDER.reference, order: ORDER }; },

        async fetchReturnContext() { return { order: ORDER, items: [], reasons: [], resolutions: [] }; },
        async processReturn() { return { data: {} }; },
        async uploadReturnEvidence() { return { data: { path: '' } }; },
        async deleteReturnEvidence() { return { data: {} }; },

        async applyAppDiscount() { return { data: {} }; },
        async removeAppDiscount() { return { data: {} }; },
        async connectPaymentGateway() { return { data: {} }; },
    },
});
