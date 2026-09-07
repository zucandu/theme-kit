<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { storefrontApi } from '@/services/api';
import { useRoute } from 'vue-router';
import { useOrderStore } from '@/stores/order';
import { useCartStore } from '@/stores/cart';
import { useSettingsStore } from '@/stores/settings';

const props = defineProps({
    hook: {
        type: Object,
        required: true,
    },
    hookPoint: {
        type: String,
        required: true,
    },
    queryParams: {
        type: Object,
        default: () => ({}),
    },
    // Optional CSS selector for a reference input in the parent DOM. When set,
    // the host copies that element's computed style into the iframe (via
    // zuc:hook-style on hook-ready) so an embedded <input> matches the theme's
    // own inputs. Omit for hooks that don't render a themed input (e.g. toggles).
    styleRef: {
        type: String,
        default: '',
    },
    // Render as a floating corner iframe instead of inline in the page flow.
    // The app inside reports which corner it wants and how tall it currently
    // is; the host anchors a fixed, transparent iframe there and lets it catch
    // clicks only while it has something up, so the store stays usable behind
    // it. See storefront_overlay in config/constants.php.
    overlay: {
        type: Boolean,
        default: false,
    },
});

// How wide the floating iframe may get, and how much of the viewport it may
// ever take. Caps, not sizes: an app cannot grow its overlay to cover the
// store, whatever it reports.
const OVERLAY_WIDTH_PX = 380;
const OVERLAY_MAX_VIEWPORT_HEIGHT = '60vh';

// The app's own reported geometry for the floating case: how tall its content
// is right now (0 when it has nothing to show) and which corner it sits in.
const overlayHeightPx = ref(0);
const overlayPosition = ref('bottom-left');

// 'set-meta' lets an iframe write a single scalar into the host form's `meta`
// bag (e.g. the SMS app sets meta.twilio_sms on the register form). The parent
// component decides what to do with it — this hook only forwards a validated
// (key, value) pair; it never mutates form state itself.
const emit = defineEmits(['set-meta']);

const route = useRoute();
const orderStore = useOrderStore();
const cartStore = useCartStore();
const settingsStore = useSettingsStore();

const iframeRef = ref(null);
const iframeHeight = ref(props.hook.config?.height || '60px');
// Every iframe needs an accessible name. Without one a screen reader announces
// the frame as "frame" and offers no way to tell one embedded app from another,
// which axe rates `serious` (WCAG 4.1.2) — Lighthouse caught the salespop
// overlay on demo-store, 2026-09-03.
//
// `label` is the app's own name, as the hooks endpoint returns it. The hook
// point is the fallback rather than a generic "Embedded app" because it is at
// least specific ("storefront_overlay"), and an app with no label is a data
// problem to be visible, not one to paper over with a nicer string.
const iframeTitle = computed(() => props.hook.label || props.hookPoint);
// The modal is a second iframe with its own content and its own height. It is
// tracked separately so a height it reports can be routed to the modal that
// sent it, rather than resizing the inline hook sitting behind it.
const modalIframeRef = ref(null);
const hasError = ref(false);
// Hidden until the iframe reports zuc:hook-ready, so the page never shows a
// flash of the default placeholder height while content/height is still
// resolving. Falls back to visible after READY_TIMEOUT_MS in case a hook
// never sends the message (e.g. a third-party embed that predates this
// protocol) — better a late reveal than a permanently hidden hook.
const ready = ref(false);
const READY_TIMEOUT_MS = 3000;

// Modal state
const modal = reactive({
    isOpen: false,
    url: '',
    title: '',
    width: '600px',
    height: '80vh',
});

// A height the modal reports is content, not a licence to cover the screen. Cap
// it so the backdrop padding and the title bar stay visible however tall the
// app claims to be — same reasoning as OVERLAY_MAX_VIEWPORT_HEIGHT above.
const MODAL_MAX_VIEWPORT_HEIGHT = 'calc(100vh - 8rem)';

// Messages the modal iframe may send. It is the same signed app as the inline
// hook, but it is only allowed to talk about itself: its own height and closing
// itself. Discounts, meta and address fill stay restricted to the hook's own
// iframe, where the host knows which hook point the request belongs to.
const MODAL_ALLOWED_TYPES = ['zuc:modal-close', 'zuc:hook-ready', 'zuc:hook-resize'];

/**
 * Which kind of page the shopper is on, by route name.
 *
 * An overlay app runs site-wide and generally wants to behave differently per
 * page — show on the homepage and product pages, stay off checkout, that sort
 * of thing. Without this it cannot tell: the overlay iframe is signed once and
 * mounted once (see below), so its own URL says only where the visit started.
 *
 * Named groups rather than the raw route name, because the route names are this
 * repo's business and an app should not have to learn that a manufacturer page
 * and a search page are both "a list of products". Anything unrecognised is
 * `other` rather than a guess — an app deciding whether to speak is better off
 * being told "somewhere else" than being told wrong.
 */
const PAGE_TYPES = {
    index: 'home',
    product: 'product',
    category: 'collection',
    manufacturer: 'collection',
    search: 'collection',
    cart: 'cart',
    checkout: 'checkout',
    checkout_success: 'checkout',
    pay: 'checkout',
    invoice: 'checkout',
    blog: 'blog',
    blog_listing: 'blog',
    blog_category: 'blog',
    blog_author: 'blog',
    blog_search: 'blog',
    article_details: 'blog',
};

const pageTypeFor = (name) => {
    if (typeof name !== 'string' || name === '') return 'other';
    if (PAGE_TYPES[name]) return PAGE_TYPES[name];

    // Every account_* route is the shopper's own area. Matched by prefix so a
    // new one does not silently become `other`, which is the group an app is
    // most likely to treat as "safe to show on".
    return name.startsWith('account') ? 'account' : 'other';
};

/**
 * The floating iframe's style: anchored to the corner the app asked for, no
 * wider than the cap, no taller than the app's content or the viewport cap —
 * and transparent, so only what the app draws shows over the store.
 *
 * It catches clicks (pointer-events: auto) ONLY while the app reports a height,
 * i.e. while it actually has a pop up. The rest of the time it is zero-height
 * and click-through, so the store behind it is fully usable. This is why the
 * overlay is a corner box and not a full-viewport sheet: a full-viewport iframe
 * would have to swallow every click on the page to let the app receive one.
 */
const overlayStyle = computed(() => {
    const interactive = overlayHeightPx.value > 0;
    const corner = overlayPosition.value === 'bottom-right'
        ? { right: '0px', left: 'auto' }
        : { left: '0px', right: 'auto' };

    return {
        position: 'fixed',
        bottom: '0px',
        ...corner,
        width: `min(${OVERLAY_WIDTH_PX}px, 100vw)`,
        height: interactive ? `min(${overlayHeightPx.value}px, ${OVERLAY_MAX_VIEWPORT_HEIGHT})` : '0px',
        border: 'none',
        background: 'transparent',
        pointerEvents: interactive ? 'auto' : 'none',
        overflow: 'hidden',
        zIndex: 2147483000,
    };
});

/**
 * Read the app's reported corner and height from a ready/resize message. Both
 * are optional and validated: an unknown corner or a non-number height is
 * ignored rather than trusted.
 */
const applyOverlayGeometry = (msg) => {
    if (msg.position === 'bottom-left' || msg.position === 'bottom-right') {
        overlayPosition.value = msg.position;
    }

    const height = typeof msg.height === 'number'
        ? msg.height
        : parseInt(msg.height, 10);

    if (Number.isFinite(height)) {
        overlayHeightPx.value = Math.max(0, height);
    }
};

/**
 * Ask the server for a signed embed URL.
 *
 * 🚨 This used to sign here, with `props.hook.signing_secret` and WebCrypto —
 * which meant the store's HMAC key was served to every visitor by a public
 * endpoint, and anyone could mint a valid signature for any `customer_id`. The
 * key never reaches the browser now.
 *
 * Note what is NOT sent: `customer_id` and `store_url`. The server takes the
 * customer from the bearer token, because a signature over a value the caller
 * supplied proves only that the caller asked for it. `order_id` is sent but the
 * server drops it unless it belongs to that customer.
 */
const fetchSignedUrl = async (path = null) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(props.queryParams)) {
        if (value !== null && value !== undefined && key !== 'customer_id' && key !== 'store_url') {
            params.set(key, value);
        }
    }
    // 🚨 Read from the route, not from queryParams, and read it HERE rather
    // than in TrackOrderDetails.vue — because this file is the one that arrives.
    // `cores/` is re-copied into tenant-assets on every update (StoreUpdateJob
    // step 3c), while `storefront/` is additive-only: a store that already has
    // TrackOrderDetails.vue keeps its own copy for good. So a store on this
    // release runs the new signing call with the old page still sending a bare
    // `order_id`, which the server drops for an anonymous caller — and the guest
    // tracking embed silently goes blank. The order reference is that page's
    // credential; forwarding it here works no matter which copy of the page the
    // store has.
    if (route?.params?.ref && !params.has('reference')) {
        params.set('reference', route.params.ref);
    }

    if (path) params.set('path', path);

    const res = await storefrontApi.get(
        `/api/v3/storefront/hooks/${props.hook.id}/signed-url?${params.toString()}`,
    );

    return res.data.url;
};

/**
 * Signing is a network call now, so it can fail — it never could when the
 * browser did it locally. Without this the iframe src stays empty, `ready`
 * never flips and the hook just is not there, which reads as "the app is
 * broken" rather than "one request failed".
 */
const resolveSignedUrl = async (path = null) => {
    try {
        return await fetchSignedUrl(path);
    } catch (error) {
        console.error(`Failed to sign storefront hook [${props.hook.id}]:`, error);
        hasError.value = true;
        ready.value = true;

        return '';
    }
};

const iframeSrc = ref('');

// buildSrc / buildModalUrl no longer construct or sign the URL. The store host
// used to be resolved here (zucandu_subdomain, with store_url as a fallback,
// because a custom-domain store must not send its custom domain — the hub does
// not know the app by it). That resolution now lives in
// StorefrontHookController::canonicalStoreHost(), server-side, where the
// signature is produced.

const buildSrc = async () => {
    iframeSrc.value = await resolveSignedUrl();
};

const buildModalUrl = async (path) => {
    return await resolveSignedUrl(path);
};

const isValidModalPath = (path) => {
    if (typeof path !== 'string') return false;
    if (!path.startsWith('/')) return false;
    if (/^(javascript|data|vbscript):/i.test(path)) return false;
    if (path.startsWith('//')) return false;
    if (path.includes('..')) return false;
    return true;
};

const closeModal = () => {
    modal.isOpen = false;
    modal.url = '';
};

/**
 * Normalise a height an iframe gave us to a CSS length. Apps send either a
 * number of pixels or an already-formatted string; anything else is rejected,
 * because it would be interpolated straight into a style and take the whole
 * declaration down with it.
 */
const toCssHeight = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return `${Math.max(0, value)}px`;
    if (typeof value !== 'string' || value.trim() === '') return null;

    const raw = value.trim();

    // 🚨 A bare number as a string is the single most common shape an app sends,
    // because `String(el.scrollHeight)` produces it. Passing it through unitless
    // yields `height: 520`, which is not a CSS length: the declaration is dropped
    // and the frame keeps whatever height it had. Treat it as pixels, the same as
    // the numeric case above.
    if (/^\d+(?:\.\d+)?$/.test(raw)) return `${raw}px`;

    return raw;
};

// A CSS length, which is what `min()` requires — `auto`, keywords and junk are all
// valid enough for a bare `height:` but poison the whole `min()` expression.
const CSS_LENGTH = /^\d+(?:\.\d+)?(?:px|em|rem|vh|vw|vmin|vmax|%|pt|pc|cm|mm|in|ch|ex|q)$/i;

/**
 * A modal height, held to the viewport cap whatever the app asked for.
 *
 * 🚨 Returns null rather than an expression whenever the value cannot go inside
 * `min()`, so the caller's fallback actually fires. Three shapes get here and all
 * three used to produce broken CSS:
 *
 *   'auto'  → `min(auto, …)`  invalid — and `auto` is the first thing a developer
 *                             reaches for when the content decides the height
 *   0 / '0' → `min(0px, …)`   valid CSS, zero-height modal: worse than invalid,
 *                             because it renders as an empty box with no clue why
 *   '520'   → handled upstream now, but a unitless value must never reach `min()`
 *
 * A modal is a thing the shopper is looking at; there is no useful reading of
 * "zero pixels tall", so a non-positive height means *keep what you had*.
 */
const cappedModalHeight = (value) => {
    const height = toCssHeight(value);

    if (height === null || ! CSS_LENGTH.test(height) || parseFloat(height) <= 0) return null;

    return `min(${height}, ${MODAL_MAX_VIEWPORT_HEIGHT})`;
};

const applyInlineHeight = (msg) => {
    const height = toCssHeight(msg.height);
    if (height !== null) iframeHeight.value = height;
};

const applyModalHeight = (msg) => {
    const height = cappedModalHeight(msg.height);
    if (height !== null) modal.height = height;
};

const handleMessage = (event) => {
    const msg = event.data;
    if (!msg?.type?.startsWith('zuc:')) return;

    // zuc:scroll-to-hook is a cross-iframe broadcast: any iframe can request
    // the parent to scroll another hook point into view. Handle it before the
    // source-filter so every mounted instance can claim its matching target.
    if (msg.type === 'zuc:scroll-to-hook') {
        const target = typeof msg.target === 'string' ? msg.target : '';
        if (target && target === props.hookPoint && iframeRef.value) {
            iframeRef.value.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
    }

    const fromOwnIframe = iframeRef.value && event.source === iframeRef.value.contentWindow;
    const fromModalIframe = modal.isOpen && modalIframeRef.value
        && event.source === modalIframeRef.value.contentWindow;

    // Height messages from the modal must never resize the underlying inline
    // hook — that is why they used to be dropped here. Dropping them also left
    // the modal stuck at whatever height zuc:modal-open guessed, so an app had
    // to hard-code a number and live with dead space or a scrollbar. They are
    // admitted now and routed to the modal instead (see the switch below), which
    // keeps the original guarantee while letting the modal fit its content.
    if (!fromOwnIframe
        && !(fromModalIframe && MODAL_ALLOWED_TYPES.includes(msg.type))
        && !(modal.isOpen && msg.type === 'zuc:modal-close')) {
        return;
    }

    switch (msg.type) {
        case 'zuc:hook-ready':
            // The modal reporting ready says nothing about the inline hook, so
            // it must not flip `ready` or trigger sendHookStyle() — those belong
            // to the hook's own iframe, which is what styleRef is measured for.
            if (fromModalIframe) {
                applyModalHeight(msg);
                break;
            }

            if (props.overlay) {
                applyOverlayGeometry(msg);
            } else {
                applyInlineHeight(msg);
            }
            ready.value = true;
            // Once the iframe is ready, push the host theme's input style so an
            // embedded <input> matches the surrounding fields (no-op if styleRef
            // is unset or matches nothing).
            sendHookStyle();
            // And where the shopper is, for an overlay app that runs site-wide.
            // Sent here rather than on mount because this is the first moment
            // the iframe is known to be listening. No-op for inline hooks.
            sendRoute();
            break;
        case 'zuc:hook-resize':
            if (fromModalIframe) {
                applyModalHeight(msg);
                break;
            }

            if (props.overlay) {
                applyOverlayGeometry(msg);
            } else {
                applyInlineHeight(msg);
            }
            break;
        case 'zuc:hook-error':
            hasError.value = true;
            console.error(`Storefront hook error [${props.hook.id}]:`, msg.message);
            break;
        case 'zuc:set-meta':
            // Forward a single (key, value) into the host form's meta bag. Only
            // string keys and JSON-primitive values are accepted; nested
            // objects/arrays are rejected so an iframe can't smuggle a large or
            // structured payload into a customer record via meta.
            if (typeof msg.key === 'string' && msg.key !== ''
                && (msg.value === null || ['string', 'number', 'boolean'].includes(typeof msg.value))) {
                emit('set-meta', { key: msg.key, value: msg.value });
            }
            break;
        case 'zuc:modal-open':
            if (msg.url && isValidModalPath(msg.url)) {
                buildModalUrl(msg.url).then(signedUrl => {
                    // Empty means signing failed — opening an empty modal is
                    // worse than not opening one.
                    if (!signedUrl) return;
                    modal.url = signedUrl;
                    modal.title = msg.title || '';
                    modal.width = msg.width || '600px';
                    // Capped the same way a reported height is: the opening size
                    // is just as much the app's own number, and an oversized one
                    // would push the close button off-screen before the iframe
                    // has had a chance to report anything.
                    modal.height = cappedModalHeight(msg.height) ?? cappedModalHeight('80vh');
                    modal.isOpen = true;
                });
            }
            break;
        case 'zuc:modal-close':
            closeModal();
            break;
        case 'zuc:request-context':
            // Remembered so the totals can be re-sent when they change. Only apps that
            // asked are told: an app that never wanted context is not listening for it,
            // and a message it ignores is still a message it has to receive and discard.
            wantsContext.value = true;
            sendContext();
            break;
        case 'zuc:apply-discount':
            // msg.module MUST equal hook.client_id — prevents an iframe owned by app A
            // from applying a discount under app B's module id. msg.input carries raw
            // user intent only (e.g. { redeem_reward_points: 70 }); any `amount` field
            // is ignored because applyAppDiscount -> CheckoutService::applyDiscount
            // recomputes the dollar amount server-to-server via appService->postData.
            handleApplyDiscount(msg);
            break;
        case 'zuc:remove-discount':
            handleRemoveDiscount(msg);
            break;
        case 'zuc:fill-address':
            // An app (e.g. Radar autocomplete) pushes a chosen address into the
            // checkout form. msg.module MUST equal hook.client_id (same anti-spoof
            // guard as apply-discount). Prefill only — written to the order store,
            // never auto-submitted or trusted server-side (an address isn't money).
            handleFillAddress(msg);
            break;
    }
};

// Computed-style properties copied from the reference input into the iframe.
// Fixed whitelist — the iframe applies these keys individually, never a raw CSS
// string, so the host can only influence an input's appearance, not inject CSS.
const HOOK_STYLE_PROPS = [
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderStyle', 'borderColor', 'borderRadius',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
    'color', 'backgroundColor', 'height', 'boxShadow',
];

// Copy the reference input's computed style into the iframe so its embedded
// <input> matches the theme. No-op when styleRef is unset / selector misses.
const sendHookStyle = () => {
    if (!props.styleRef) return;
    let el;
    try {
        el = document.querySelector(props.styleRef);
    } catch {
        return; // invalid selector — ignore
    }
    if (!el) return;

    // Renamed off `computed`, which is now imported from Vue for overlayStyle.
    const computedStyle = window.getComputedStyle(el);
    const style = {};
    for (const prop of HOOK_STYLE_PROPS) {
        const val = computedStyle[prop];
        if (val) style[prop] = val;
    }
    replyToIframe({ type: 'zuc:hook-style', style });
};

// Send a message back to the iframe that originated the request. Using the known
// iframe contentWindow instead of event.source guarantees we don't reply to a
// spoofed sender. Origin '*' is acceptable here because the iframe was loaded from
// a URL we signed with HMAC; it cannot be substituted by a third party.
const replyToIframe = (message) => {
    iframeRef.value?.contentWindow?.postMessage(message, '*');
};

/**
 * Tell an overlay app which page the shopper is on, now and whenever that
 * changes.
 *
 * 🚨 This is a message and not a signed query parameter, and both halves of
 * that are deliberate.
 *
 * Not a query parameter, because the overlay iframe is signed once and mounted
 * once. It is rendered by the storefront layout, not by a page, so it survives
 * every in-app navigation — which is the whole reason it can keep state across
 * a visit. A parameter baked into its `src` would freeze at the landing page
 * and then be quietly wrong for the rest of the visit, which is worse than
 * absent: an app cannot tell a stale answer from a current one.
 *
 * Not signed, because the signature means "the store asserts this" and the
 * route is something the browser knows and the browser is the caller — signing
 * it would prove only that the caller asked for it, the same reason
 * `customer_id` is not in CLIENT_PARAMS. Nothing here is a permission: an app
 * uses it to decide whether to speak, so the worst a forged value buys is a
 * notification on a page the merchant would rather not have had one.
 *
 * Overlay only. An inline hook is mounted by the page it belongs to and
 * unmounted when that page goes, so it already knows where it is.
 */
const sendRoute = () => {
    if (!props.overlay) return;

    replyToIframe({
        type: 'zuc:route',
        path: route.path,
        page_type: pageTypeFor(route.name),
    });
};

/**
 * Re-send on navigation. Watching `route.path` rather than the whole route
 * object: a query-string change (a filter, a tracking parameter) is the same
 * page to every app that asked this question, and re-announcing it would have
 * an app treat one page view as several.
 */
watch(
    () => route.path,
    () => {
        // Only once the app has said it is listening. Before hook-ready the
        // iframe may not have installed its message handler, and a message
        // posted into a window that is not listening is simply lost.
        if (ready.value) sendRoute();
    },
);

/**
 * Cart totals, for an app bounding user input or reacting to a threshold.
 *
 * 🚨 Subtotal and currency only, and no monetary decision is made from either:
 * the backend recomputes every discount server-side (`docs/CHECKOUT_SUBTOTAL_TRUST.md`).
 * This is a number an app may *read* to decide what to say, never one it may spend.
 */
const wantsContext = ref(false);

const sendContext = () => {
    replyToIframe({
        type: 'zuc:context',
        module: props.hook.client_id,
        subtotal: cartStore.subtotal,
        currency: settingsStore.selectedCurrency,
    });
};

/**
 * Re-send whenever the totals change, to whichever apps asked for them.
 *
 * 🚨 Without this, `zuc:context` is answer-once and silently goes stale. An app
 * that mounts on the cart page, asks, and is told `subtotal: 450` is never told
 * again when the shopper edits a quantity — the page does not remount, so the
 * iframe lives on holding a number that stopped being true. A "spend $50 more
 * for a free gift" banner then counts down from the wrong figure, which is worse
 * than showing nothing: the app cannot tell a stale answer from a current one.
 *
 * Watching the values rather than the cart contents deliberately. Every path
 * that moves money ends here — a quantity edit, a removed line, an applied
 * coupon, a currency switch — so one watch covers them all, including the ones
 * nobody has thought of yet. Chasing the individual mutations instead would mean
 * a new one silently not reporting, which is the failure this exists to remove.
 */
watch(
    () => [cartStore.subtotal, settingsStore.selectedCurrency],
    () => {
        if (ready.value && wantsContext.value) sendContext();
    },
);

const handleApplyDiscount = async (msg) => {
    const module = typeof msg.module === 'string' ? msg.module : '';
    if (!module || module !== props.hook.client_id) {
        replyToIframe({ type: 'zuc:discount-applied', ok: false, module, error: 'module_mismatch' });
        return;
    }

    // Apply/remove only make sense during checkout, where a draft exists.
    if (!orderStore.checkoutDraftId) {
        replyToIframe({ type: 'zuc:discount-applied', ok: false, module, error: 'no_draft' });
        return;
    }

    const input = msg.input && typeof msg.input === 'object' ? msg.input : {};
    const ok = await orderStore.applyAppDiscount(module, input);
    replyToIframe({ type: 'zuc:discount-applied', ok, module });
};

const handleRemoveDiscount = async (msg) => {
    const module = typeof msg.module === 'string' ? msg.module : '';
    if (!module || module !== props.hook.client_id) {
        replyToIframe({ type: 'zuc:discount-removed', ok: false, module, error: 'module_mismatch' });
        return;
    }

    if (!orderStore.checkoutDraftId) {
        replyToIframe({ type: 'zuc:discount-removed', ok: false, module, error: 'no_draft' });
        return;
    }

    const ok = await orderStore.removeAppDiscount(module);
    replyToIframe({ type: 'zuc:discount-removed', ok, module });
};

const handleFillAddress = (msg) => {
    const module = typeof msg.module === 'string' ? msg.module : '';
    if (!module || module !== props.hook.client_id) {
        replyToIframe({ type: 'zuc:address-filled', ok: false, module, error: 'module_mismatch' });
        return;
    }

    const address = msg.address && typeof msg.address === 'object' ? msg.address : null;
    if (!address) {
        replyToIframe({ type: 'zuc:address-filled', ok: false, module, error: 'no_address' });
        return;
    }

    // Prefill only — the order store holds it; the checkout Address form maps it
    // into its fields. No backend call (an address isn't money to recompute).
    orderStore.prefillAddress(address);
    replyToIframe({ type: 'zuc:address-filled', ok: true, module });
};

let readyTimeout = null;

onMounted(() => {
    window.addEventListener('message', handleMessage);
    buildSrc();
    readyTimeout = setTimeout(() => { ready.value = true; }, READY_TIMEOUT_MS);
});

onUnmounted(() => {
    window.removeEventListener('message', handleMessage);
    clearTimeout(readyTimeout);
});
</script>

<template>
    <!-- Inline: sits in the page flow where the hook point is placed. -->
    <div v-if="!overlay && !hasError && iframeSrc" :style="{ opacity: ready ? 1 : 0, transition: 'opacity 150ms ease' }">
        <iframe
            ref="iframeRef"
            :src="iframeSrc"
            :title="iframeTitle"
            :style="{ height: iframeHeight, width: '100%', border: 'none' }"
            :data-hook-point="hookPoint"
            :data-hook-id="hook.id"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            loading="lazy"
        ></iframe>
    </div>

    <!-- Floating: a corner-anchored, transparent iframe teleported to the body
         so nothing on the page can clip it or knock it off the viewport. Only
         click-catching while the app has a pop up (see overlayStyle). -->
    <Teleport v-if="overlay" to="body">
        <iframe
            v-if="!hasError && iframeSrc"
            ref="iframeRef"
            :src="iframeSrc"
            :title="iframeTitle"
            :style="overlayStyle"
            :data-hook-point="hookPoint"
            :data-hook-id="hook.id"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            loading="lazy"
        ></iframe>
    </Teleport>

    <!-- Modal overlay -->
    <Teleport to="body">
        <Transition
            enter-active-class="duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div v-if="modal.isOpen" class="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/50" @click="closeModal"></div>
                <div class="relative w-full rounded-xl bg-white shadow-2xl overflow-hidden" :style="{ maxWidth: modal.width }">
                    <div v-if="modal.title" class="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                        <h3 class="text-base font-semibold text-gray-900">{{ modal.title }}</h3>
                        <button @click="closeModal" class="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <button v-else @click="closeModal" class="absolute top-3 right-3 z-10 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <!-- `modal.title` when the app gave one: it is already the visible heading
                         above, so the frame and its heading announce as the same thing. -->
                    <iframe
                        ref="modalIframeRef"
                        :src="modal.url"
                        :title="modal.title || iframeTitle"
                        :style="{ height: modal.height, width: '100%', border: 'none' }"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    ></iframe>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
