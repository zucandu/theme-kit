/**
 * The payment JS modules the storefront bundle ships, keyed by module name.
 *
 * 🚨 This is NOT the list of methods a store has enabled. That one is
 * `checkout.payment_methods` (order store), and conflating the two is what this
 * file used to do: it returned `computed(() => checkout.payment_methods)`, an
 * ARRAY inside a ref, where the theme does
 * `availablePaymentMethods[name].jsPayment.setParams(…)`. Every lookup came back
 * undefined, /pay/:token threw in `onMounted`, and the theme's own catch then
 * threw again reaching for `error.response.data` — so the page reported a
 * network error it never made.
 *
 * 🚨 All five keys exist, and none may be dropped. The set is fixed by what the
 * bundle ships, not by what the merchant switched on, so every module is present
 * on every store. A theme may index any of these names, and a missing key is not
 * an empty payment area, it is a TypeError.
 *
 * Only MoneyOrder RENDERS anything, which is the honest split rather than a
 * shortcut. It is the one module whose button is drawn by our own code: it has
 * no gateway, no API keys and no redirect. Braintree, PayPal, Square and Stripe
 * all draw theirs from an SDK fetched from the vendor, which this kit cannot do
 * — so they mount nothing and say so once. Drawing a look-alike button for them
 * would be the kit inventing a widget the store renders differently, and a
 * theme laid out against it would be laid out against fiction.
 */
// 🚨 Imported through the '@' alias, the SAME specifier the theme and the
// platform's own payment modules use. A relative path here resolves to the
// same file but a different module URL under Vite, which registers the store
// twice: the click updated one copy while the checkout watched the other, so
// paying set orderRef and nothing redirected.
import { useOrderStore } from '@/stores/order';
import { mountPayButton, clearPayButton } from '../services/payButton.js';

/** Every module the bundle ships. Keys must exist even when nothing renders. */
const MODULES = ['braintree', 'moneyorder', 'paypal', 'square', 'stripe'];

const RENDERS = 'moneyorder';

const seen = new Set();

function offline(name, what) {
    if (seen.has(name)) return;
    seen.add(name);
    console.info(`%c[theme-kit] offline%c ${name} -> ${what}`, 'color:#8a8274', 'color:inherit');
}

function makeModule(name) {
    const jsPayment = {
        params: {},

        setParams: (order) => (jsPayment.params = order),

        reset: clearPayButton,

        loadScript: () => {
            jsPayment.reset();

            if (name !== RENDERS) {
                offline(name, 'gateway SDK not fetched, nothing mounted');
                return;
            }

            // The theme owns this element. A theme that never renders it gets
            // silence, exactly as on a live store — not an exception.
            mountPayButton(() => jsPayment.checkoutProcess());
        },

        currencyDecimalDigits: (currency) => (['JPY', 'TWD', 'VND'].includes(currency) ? 0 : 2),

        /**
         * Complete the order — against the fixture order, not a real one.
         *
         * 🚨 This used to be a deliberate no-op, on the reasoning that a fake
         * success sends the theme to a confirmation page for an order that does
         * not exist. That reasoning was wrong for this kit. The confirmation page
         * IS one of the theme developer's pages, and refusing to place the order
         * left it — and the settled state of /pay/:token — with no route into it
         * at all: the last screen of the flow could not be seen, let alone
         * styled. Every other surface here renders against a fixture order; this
         * one now does too.
         *
         * It writes nothing anywhere. `completeCheckout()` sets `orderRef`, the
         * theme's own watcher does the redirect.
         */
        checkoutProcess: async () => {
            offline(name, 'checkout submitted, completing against the fixture order');
            useOrderStore().completeCheckout();
        },

        overlay: () => {},
    };

    return { jsPayment };
}

const availablePaymentMethods = Object.fromEntries(MODULES.map((name) => [name, makeModule(name)]));

export function useAvailablePaymentMethods() {
    return { availablePaymentMethods };
}
