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
import { mountPayButton } from '../services/payButton.js';

const ORDER = orderFixture.order;
const ADDRESSES = customer.customer.addresses;

export const useOrderStore = defineStore('order', {
    state: () => ({
        /**
         * The reference of the order the shopper JUST placed — empty until they
         * place one, exactly as on a live store.
         *
         * 🚨 It must start empty, and that is the whole mechanism behind the Pay
         * button. Both checkout and /pay/:token learn that an order went through
         * by WATCHING this value change; a watcher does not fire for a value that
         * was already set at mount. Seeding it with the fixture's reference — as
         * this did — left `completeCheckout()` writing the same string it already
         * held, so nothing changed, nothing fired, and paying did nothing.
         */
        orderRef: '',

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

        /**
         * Opening the checkout clears the last placed order.
         *
         * Without this, a second run through the flow in the same session cannot
         * redirect: `orderRef` still holds the reference from the first one, so
         * `completeCheckout()` writes an unchanged value and the theme's watcher
         * stays quiet. A live store hands out a fresh draft here for the same
         * reason — the previous order is finished business.
         */
        async initializeCheckout() {
            this.orderRef = '';
            return { draft_id: this.checkoutDraftId };
        },

        /**
         * Place the order. The kit's one pretend write, and a deliberate one.
         *
         * Setting `orderRef` is all it does, because that is all a theme watches:
         * Checkout's form redirects to /checkout-success/:ref on the change, and
         * /pay/:token flips to its settled state. Nothing is submitted anywhere —
         * the point is only that a theme developer can reach, and style, the last
         * screen of the flow.
         */
        completeCheckout() {
            this.orderRef = ORDER.reference;
        },

        /**
         * Draw the payment widget into the theme's `#render-payment-gateway`.
         *
         * On a store this is the payment module's job, and what it mounts differs
         * per gateway. The kit mounts the one button that needs no gateway, no
         * keys and no redirect — the Check/Money Order button, which is also the
         * only method enabled in checkout.json.
         */
        connectPaymentGateway() {
            mountPayButton(() => this.completeCheckout());
            return { data: {} };
        },

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

        /**
         * A "pay this by link" request, in the shape the storefront API answers
         * with: the payment request's own fields plus the order's `reference`.
         *
         * 🚨 Every field here is load-bearing, not padding. The three this used
         * to return (order_id, reference, amount) left `payment_method`
         * undefined, and PaymentRequest.vue does
         * `orderPayment.value.toLowerCase()` on it before indexing the payment
         * modules — so /pay/:token threw in `onMounted`, and the theme's own
         * `catch` threw a second time reaching for `error.response.data` on a
         * TypeError. The page then reported a failed request it never made,
         * which sends a theme developer looking for a network problem.
         *
         * `payment_method` is the MODULE name, so `.toLowerCase()` lands on a
         * key in `useAvailablePaymentMethods` — MoneyOrder, matching the enabled
         * method in checkout.json. It is not the display label the order row
         * carries ("Cash on Delivery"); those are two different fields and only
         * one of them resolves to a module.
         *
         * `status` is 'pending' so the payable state renders. Set it to 'paid'
         * to see the already-settled one — the theme swaps the whole panel.
         */
        async getPaymentRequest() {
            // Opening a payment link clears the last placed order, for the same
            // reason initializeCheckout() does: PaymentRequest.vue flips to its
            // settled state by WATCHING orderRef change, and a value left over
            // from an earlier checkout would make the Pay button inert.
            this.orderRef = '';

            return {
                data: {
                    payment_request: {
                        id: 1,
                        order_id: ORDER.id,
                        customer_id: 1,
                        token: 'theme-kit-demo-token',
                        reference: ORDER.reference,
                        amount: ORDER.order_total,
                        currency: ORDER.currency,
                        status: 'pending',
                        payment_method: 'MoneyOrder',
                        note: 'Balance due on your order.',
                        expires_at: null,
                        paid_at: null,
                        meta: null,
                    },
                },
            };
        },

        async verify() { return { verified: true, ref: ORDER.reference, order: ORDER }; },

        async fetchReturnContext() { return { order: ORDER, items: [], reasons: [], resolutions: [] }; },
        async processReturn() { return { data: {} }; },
        async uploadReturnEvidence() { return { data: { path: '' } }; },
        async deleteReturnEvidence() { return { data: {} }; },

        async applyAppDiscount() { return { data: {} }; },
        async removeAppDiscount() { return { data: {} }; },
    },
});
