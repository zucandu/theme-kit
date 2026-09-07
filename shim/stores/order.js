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
import reasonsFixture from '../../fixtures/return-reasons.json';
import resolutionsFixture from '../../fixtures/return-resolutions.json';
// ⚙️ order.js and useAvailablePaymentMethods import each other, exactly as they do
// on the platform. Safe because both uses are deferred to call time: nothing at
// module level in either file reaches into the other.
import { useAvailablePaymentMethods } from '@/composables/useAvailablePaymentMethods';
// The store navigates on its own, as the platform's does, so it needs the router
// instance rather than a component's `useRouter()`.
import router from '../../runtime/router.js';

const ORDER = orderFixture.order;
const ADDRESSES = customer.customer.addresses;

/**
 * What the shopper is told will happen next, per resolution.
 *
 * Copied from ReturnPolicyService, because the strings are the platform's, not
 * a theme's: the form prints them under the chosen reason and a theme has to
 * lay out sentences of this length rather than one-word labels.
 */
const NEXT_STEP = {
    refund: 'We will review eligibility and send return instructions if the item must be returned.',
    warranty_replacement: 'We will review the evidence and let you know whether the original item must be returned.',
    replacement: 'We will review the evidence and arrange a no-charge replacement if approved.',
};
const nextStep = (code) => NEXT_STEP[code] || 'We will review your request and contact you with the next step.';

const RESOLUTION_LABEL = {
    refund: 'Refund after an eligible return',
    warranty_replacement: 'No-charge warranty replacement after review',
    replacement: 'No-charge replacement after review',
};

/**
 * The reasons offered against one order item.
 *
 * 🚨 This is NOT the raw `/return-reasons` payload, and the difference is one
 * key: a raw reason has `name`, while the per-item projection the return form
 * reads has `label`. Handing the raw rows straight through renders a list of
 * empty radio labels. Both fixtures had shipped unused since the kit was
 * written — this is what they are for.
 */
const RETURN_REASONS = reasonsFixture.reasons.map((reason) => {
    const resolution = resolutionsFixture.resolutions
        .find((candidate) => candidate.slug === reason.resolution_code);

    return {
        code: reason.code,
        label: reason.name,
        resolution_code: reason.resolution_code,
        resolution_label: RESOLUTION_LABEL[reason.resolution_code] || resolution?.name || 'Review required',
        help_text: reason.help_text,
        minimum_photo_count: Number(reason.minimum_photo_count || 0),
        next_step: nextStep(reason.resolution_code),
    };
});

/**
 * A request the shopper already sent, so the "your existing requests" panel has
 * something to render. Empty this to see the first-time state.
 */
const RMAS = [
    {
        reference: 'RMA-1001-DEMO',
        status: { id: 1, name: 'Requested' },
        created_at: '2026-09-03 08:40:00',
        items: [
            {
                order_item_id: 2,
                quantity: 1,
                reason_code: 'arrived_damaged',
                reason_label: 'The item arrived damaged',
                resolution_code: 'replacement',
                resolution_label: RESOLUTION_LABEL.replacement,
                return_required: 1,
                next_step: nextStep('replacement'),
            },
        ],
    },
];

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
            this.setOrderRef(ORDER.reference);
        },

        /**
         * Record the placed order and go to its confirmation page.
         *
         * 🚨 The STORE navigates. It does not set a value and hope a theme is
         * watching — `setOrderRef` pushes `/checkout-success/:ref` itself, and
         * that is the only mechanism the default theme has: its checkout contains
         * no `orderRef` watcher at all. The one in heads22v3's Form.vue is a
         * second, theme-side belt on top of this, which is exactly how an earlier
         * version of `completeCheckout` came to "work" — it was verified against
         * the theme that happens to carry the belt, and did nothing on the theme
         * that does not.
         *
         * Pushing to the page a shopper is already on throws NavigationDuplicated;
         * the platform swallows that one and reports anything else, so this does
         * too.
         */
        setOrderRef(reference) {
            this.orderRef = reference;
            if (!reference) return;

            router.push({ path: `/checkout-success/${reference}` }).catch((error) => {
                if (error?.name !== 'NavigationDuplicated') console.error(error);
            });
        },

        /**
         * Hand the chosen payment module the order, and let IT draw the widget.
         *
         * 🚨 This is the platform's own logic, not a shortcut to the same picture.
         * The first version mounted a Pay button unconditionally, which was wrong
         * in three ways a theme can see:
         *
         *   - A store shows NOTHING until both a payment and a shipping method are
         *     selected. Mounting regardless meant the "choose a method first"
         *     state could never be laid out.
         *   - A store resolves the module by the selected method's own id and
         *     gives up when there is none. Always drawing the MoneyOrder button
         *     meant picking Stripe showed a working button here and nothing live.
         *   - `mode: 'sync'` is not a remount. The theme sends it when only the
         *     shipping changed, and a store asks the gateway to absorb the new
         *     total in place; tearing the widget down and rebuilding it is what
         *     happens when the gateway CANNOT, not what happens normally.
         *
         * `setParams` was never called either, so a module had no order to read.
         */
        connectPaymentGateway({ mode = 'mount', reason = 'unspecified' } = {}) {
            const { availablePaymentMethods } = useAvailablePaymentMethods();

            if (!this.checkoutSelections.payment?.id || !this.checkoutSelections.shipping?.id) return;

            const payment = this.checkoutSelections.payment;
            const gateway = availablePaymentMethods[String(payment.id).toLowerCase()];
            if (!gateway) return;

            gateway.jsPayment.setParams({ ...this.checkoutParams, init_data: payment.init_data });

            if (mode === 'sync') {
                // Only a literal `true` keeps the instance alive — the platform's
                // rule, kept because a gateway that cannot prove the sync was safe
                // must not be trusted to have absorbed the new total.
                try {
                    if (gateway.jsPayment.syncParams?.({ reason }) === true) return;
                } catch (error) {
                    console.error('Payment gateway sync failed, remounting', payment.id, reason, error?.name);
                }
            }

            gateway.jsPayment.loadScript();
        },

        // Return shapes follow the theme's own call sites: the order list reads
        // `res.orders`, PaymentRequest reads `res.data.payment_request`, and the
        // verify form reads `verified.ref`.
        async retrieveCustomerOrders() { return { orders: [ORDER] }; },

        async fetchOrderDetailsByRef() {
            this.retrieveOrder = ORDER;
            return ORDER;
        },

        /**
         * Shipment tracking, in the shape GET /order/tracking/{ref} answers with.
         *
         * 🚨 This used to return `{ order, tracking: [], histories }` — three keys,
         * none of which a theme reads. The real response is flat, and the tracking
         * panel drives off `courier`, `tracking_number`, `tracking_url`,
         * `tracking_events[]` and `delivered`. Against the old shape every one of
         * them was undefined, so the whole timeline — dots, dates, locations, the
         * carrier link — fell through to its "no events yet" fallback and could
         * not be designed at all.
         *
         * Events are newest-first with `delivered` false, which is the state a
         * shopper actually watches. Set `delivered: true` to see the timeline's
         * completed marker; empty `tracking_events` to see the fallback.
         */
        async fetchTrackingDetailsByRef() {
            this.retrieveOrder = ORDER;

            return {
                order_id: ORDER.id,
                step: 3,
                delivered: false,
                courier: 'USPS',
                tracking_number: '9400100000000000000000',
                tracking_url: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000000000000',
                orderstatus: ORDER.orderstatus,
                tracking_events: [
                    { message: 'Out for delivery', date: '2026-09-03 07:41:00', location: 'San Jose, CA' },
                    { message: 'Arrived at destination facility', date: '2026-09-02 22:10:00', location: 'San Jose, CA' },
                    { message: 'In transit to next facility', date: '2026-09-02 11:05:00', location: 'Sacramento, CA' },
                    { message: 'Shipping label created', date: '2026-09-02 09:12:00', location: 'Camp Hill, PA' },
                ],
            };
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

        /**
         * The order, plus everything the return form needs to be filled in.
         *
         * 🚨 Four things were wrong here at once, and the return form — the
         * largest form in a storefront theme — could not be laid out at all.
         *
         *   - It returned `{ order, items, reasons, resolutions }`. The real
         *     action unwraps the response and hands back the ORDER ITSELF:
         *     `return res.data.order`. So `order.reference` and `order.id` were
         *     undefined and the page's heading read "Order #".
         *   - `items` was empty, so there was nothing to return.
         *   - `reasons` sat at the top level. They belong PER ITEM: the form
         *     reads `item.reasons` and matches the shopper's pick by `code`.
         *   - `resolutions` is not a key of this response at all. A reason
         *     already carries its own `resolution_code` / `resolution_label`.
         *
         * The per-item extras are exactly the four the controller adds on top of
         * the order-details payload: `order_item_id`, `eligible_quantity`,
         * `returnable_at_purchase` and `reasons`.
         */
        async fetchReturnContext() {
            const context = {
                ...ORDER,
                items: ORDER.items.map((item) => ({
                    ...item,
                    order_item_id: item.id,
                    eligible_quantity: Math.max(0, item.qty - (item.qty_returned || 0)),
                    returnable_at_purchase: Boolean(item.returnable),
                    reasons: RETURN_REASONS,
                })),
                rmas: RMAS,
            };

            this.retrieveOrder = context;
            return context;
        },

        async processReturn() {
            return { reference: 'RMA-1001-DEMO', status: 'Requested' };
        },

        /**
         * 🚨 `{ evidence_token, name }` — the two keys the theme destructures:
         *
         *     state.evidence.push({ token: result.evidence_token, name: result.name })
         *
         * The old `{ data: { path: '' } }` put `undefined` in both, so an
         * uploaded photo appeared as a nameless chip that could not be removed,
         * and the minimum-photo check never counted it.
         */
        async uploadReturnEvidence(orderRef, file) {
            return {
                evidence_token: `theme-kit-${Math.random().toString(36).slice(2, 10)}`,
                name: file?.name || 'evidence.jpg',
            };
        },

        async deleteReturnEvidence() { return { data: {} }; },

        async applyAppDiscount() { return { data: {} }; },
        async removeAppDiscount() { return { data: {} }; },
    },
});
