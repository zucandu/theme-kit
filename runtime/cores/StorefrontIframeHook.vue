<script setup>
/**
 * Host for an app's iframe hook.
 *
 * Renders NOTHING, and that is correct rather than lazy: a hook exists only
 * where a merchant installed an app, so the empty case is what most stores show
 * and what a theme must lay out around. The kit's `useStorefrontIframeHooks`
 * always returns an empty list, so this never has a hook to render anyway.
 *
 * The props are declared in full so a theme passing all of them — including
 * `overlay` and `styleRef` — compiles here exactly as it will on a store.
 *
 * 🚨 A hook point your theme never renders shows nothing on a real store, with
 * no error in the admin and none in the app's logs. The merchant reports it as a
 * broken app. See help.zucandu.com/article/adding-app-hook-points-to-a-theme
 */
defineProps({
    hook: { type: Object, required: true },
    hookPoint: { type: String, required: true },
    queryParams: { type: Object, default: () => ({}) },
    styleRef: { type: String, default: '' },
    overlay: { type: Boolean, default: false },
});
</script>

<template><div class="storefront-hook" :data-hook-point="hookPoint"></div></template>
