/**
 * Registers the components theme templates use WITHOUT importing them.
 *
 * `<LocalizedLink>` alone appears 88 times in the default theme with no import
 * anywhere — it resolves purely because the platform registered it globally at
 * boot. Miss this file and a theme does not render one page.
 *
 * 🚨 These come from the KIT, not from the theme.
 *
 * A theme package is `Storefront.vue` plus `storefront/`; that is all the
 * platform's installer reads and writes back. `cores/` is shared by every theme
 * and replaced wholesale on every store update, so it is not a theme developer's
 * to edit and does not ship in their package. Importing them from `@theme/cores`
 * — as the platform does, where the folder is synced in — would make the kit
 * reject a real theme package for missing a folder it is not supposed to have.
 */
import { defineAsyncComponent } from 'vue';

import MetaTags from './cores/MetaTags.vue';
import LocalizedLink from './cores/LocalizedLink.vue';
import Loading from './cores/Loading.vue';
import PriceDisplay from './cores/PriceDisplay.vue';
import PriceByCurrencyCode from './cores/PriceByCurrencyCode.vue';
import PriceConverter from './cores/PriceConverter.vue';

export default function registerGlobalComponents(app) {
    app.component('MetaTags', MetaTags);
    app.component('LocalizedLink', LocalizedLink);
    app.component('Loading', Loading);
    app.component('PriceDisplay', PriceDisplay);
    app.component('PriceByCurrencyCode', PriceByCurrencyCode);
    app.component('PriceConverter', PriceConverter);

    app.component('DisplayAddress', defineAsyncComponent(() => import('./cores/DisplayAddress.vue')));
    app.component('ActionsNavbar', defineAsyncComponent(() => import('./cores/ActionsNavbar.vue')));
    app.component('StorefrontIframeHook', defineAsyncComponent(() => import('./cores/StorefrontIframeHook.vue')));
}
