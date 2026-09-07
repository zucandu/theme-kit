/**
 * Kit entry point — the offline counterpart of the platform's app-storefront.js.
 *
 * Boot ORDER is the contract, not a style choice:
 *   1. ./globals.js FIRST and as a bare side-effect import, so `zucConfig` and
 *      `axios` exist before any other module is evaluated (see that file).
 *   2. Tailwind, then the theme's own stylesheet.
 *   3. pinia -> global components -> router -> i18n -> toast, then mount.
 *
 * Everything under `@/` resolves into ./shim. No platform source is present in
 * this tree, and nothing here talks to a network.
 */
import './globals.js';

import './app.css';
import '@theme/storefront/css/style.css';
import 'vue-toastification/dist/index.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Toast from 'vue-toastification';
import kitConfig from 'virtual:zuc-theme-config';

import App from './App.vue';
import router from './router.js';
import { createKitI18n } from './i18n.js';
import registerGlobalComponents from './globalComponents.js';

const app = createApp(App);

// Theme templates read `zucConfig` off the component instance in some places and
// off the bare global in others; the platform exposes both, so the kit does too.
app.config.globalProperties.zucConfig = window.zucConfig;

registerGlobalComponents(app);

app.use(createPinia());
app.use(router);
app.use(createKitI18n({ locale: kitConfig.locale, messages: kitConfig.messages }));
/**
 * Toast, with the platform's own duplicate filter.
 *
 * 🚨 Without `filterBeforeCreate` the kit stacks toasts a store would collapse.
 * Seen while testing the wishlist: removing an item produced TWO identical
 * "Removed from wishlist" toasts here and one on a store, because more than one
 * code path reports the same outcome and the platform suppresses a repeat of the
 * same type+content within half a second.
 *
 * Toast stacking is a layout problem — height, spacing, how many fit — so a
 * theme tuned against a doubled stack is tuned against something no shopper
 * sees. Copied from app-storefront.js, timings included.
 */
const recentToasts = new Map();

app.use(Toast, {
    timeout: 4000,
    position: 'top-right',
    filterBeforeCreate: (toast) => {
        const key = `${toast.type}:${String(toast.content)}`;
        const now = Date.now();

        if (now - (recentToasts.get(key) || 0) < 500) return false;

        recentToasts.set(key, now);
        return toast;
    },
});

// Surface template errors instead of letting Vue swallow them into a blank page.
// A theme developer's most common failure is a typo in a binding, and silence is
// the worst possible feedback for it.
app.config.errorHandler = (err, instance, info) => {
    console.error(`[theme-kit] ${info}`, err);
};

app.mount('#app');

console.info(
    '%c[theme-kit]%c running on fixture data - no store, no network.',
    'color:#c8a45c;font-weight:bold', 'color:inherit'
);
