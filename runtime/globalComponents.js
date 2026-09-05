/**
 * Registers the components theme templates use WITHOUT importing them.
 *
 * `<LocalizedLink>` alone appears 88 times in the default theme with no import
 * anywhere — it resolves purely because the platform registered it globally at
 * boot. Miss this file and a theme does not render one page.
 *
 * All nine live under `@theme/cores/`, i.e. they ship WITH the theme and are the
 * developer's own files. The kit registers them; it does not supply them, and
 * it must not replace them with mocks — edits a developer makes in cores/ have
 * to be visible here exactly as they will be on a live store.
 */
import { defineAsyncComponent } from 'vue';

import MetaTags from '@theme/cores/MetaTags.vue';
import LocalizedLink from '@theme/cores/LocalizedLink.vue';
import Loading from '@theme/cores/Loading.vue';
import PriceDisplay from '@theme/cores/PriceDisplay.vue';
import PriceByCurrencyCode from '@theme/cores/PriceByCurrencyCode.vue';
import PriceConverter from '@theme/cores/PriceConverter.vue';

export default function registerGlobalComponents(app) {
    app.component('MetaTags', MetaTags);
    app.component('LocalizedLink', LocalizedLink);
    app.component('Loading', Loading);
    app.component('PriceDisplay', PriceDisplay);
    app.component('PriceByCurrencyCode', PriceByCurrencyCode);
    app.component('PriceConverter', PriceConverter);

    app.component('DisplayAddress', defineAsyncComponent(() => import('@theme/cores/DisplayAddress.vue')));
    app.component('ActionsNavbar', defineAsyncComponent(() => import('@theme/cores/ActionsNavbar.vue')));
    app.component('StorefrontIframeHook', defineAsyncComponent(() => import('@theme/cores/StorefrontIframeHook.vue')));
}
