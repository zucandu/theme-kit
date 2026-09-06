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

        reset: () => {
            document.getElementById('render-payment-gateway')?.replaceChildren();
        },

        loadScript: () => {
            jsPayment.reset();

            if (name !== RENDERS) {
                offline(name, 'gateway SDK not fetched, nothing mounted');
                return;
            }

            // The theme owns this element. A theme that never renders it gets
            // silence, exactly as on a live store — not an exception.
            const mount = document.getElementById('render-payment-gateway');
            if (!mount) return;

            // Same element, classes and label the live MoneyOrder button has.
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full cursor-pointer';
            button.textContent = 'Pay Now';
            button.addEventListener('click', () => jsPayment.checkoutProcess());
            mount.appendChild(button);
        },

        currencyDecimalDigits: (currency) => (['JPY', 'TWD', 'VND'].includes(currency) ? 0 : 2),

        // Placing an order is the one thing the kit must not pretend to do: a
        // fake success would send the theme to a confirmation page for an order
        // that does not exist, which is worse than an obvious no-op.
        checkoutProcess: async () => {
            offline(name, 'checkout submitted, no order placed');
        },

        overlay: () => {},
    };

    return { jsPayment };
}

const availablePaymentMethods = Object.fromEntries(MODULES.map((name) => [name, makeModule(name)]));

export function useAvailablePaymentMethods() {
    return { availablePaymentMethods };
}
