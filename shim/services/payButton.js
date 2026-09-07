/**
 * The Pay button a store's payment module draws into `#render-payment-gateway`.
 *
 * That element belongs to the THEME, not to us — Checkout.vue and
 * CheckoutOrderSummary.vue each render one and the breakpoint decides which is
 * in the DOM. A store's payment module finds it by id and mounts its widget
 * there; this does the same, so a theme that moves or renames the element gets
 * the same silence here that it would get on a live store.
 *
 * 🚨 Mounting RETRIES across a few frames instead of trying once. Checkout.vue
 * reaches the gateway through a watcher on the payment selection, and Vue
 * flushes watchers BEFORE it patches the DOM — so on first load the element does
 * not exist yet at the moment the call is made. A single getElementById there
 * finds nothing, and the checkout renders with no way to pay at all.
 */

/** ~10 frames is long enough for the checkout to paint, short enough to give up. */
const FRAMES = 10;

/** Same element, classes and label the live MoneyOrder button has. */
function payButton(label, onPay) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full cursor-pointer';
    button.textContent = label;
    button.addEventListener('click', onPay);
    return button;
}

/**
 * Put the button in the theme's gateway slot, replacing whatever is there.
 *
 * `replaceChildren` rather than `appendChild`: connecting the gateway again
 * after the shopper switches shipping or payment method is normal, and appending
 * would stack a second button under the first.
 */
export function mountPayButton(onPay, label = 'Pay Now') {
    let framesLeft = FRAMES;

    const attempt = () => {
        const mount = document.getElementById('render-payment-gateway');

        // A theme need not render the element at all — give up quietly rather
        // than polling forever.
        if (!mount) {
            if (--framesLeft > 0) requestAnimationFrame(attempt);
            return;
        }

        mount.replaceChildren(payButton(label, onPay));
    };

    attempt();
}

export function clearPayButton() {
    document.getElementById('render-payment-gateway')?.replaceChildren();
}
