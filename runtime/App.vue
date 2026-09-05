<script setup>
/**
 * Root component — the kit's stand-in for the platform's themes/App.vue.
 *
 * The platform version also intercepts in-page <a href> clicks and injects
 * reCAPTCHA / analytics scripts. Neither belongs in an offline kit: there is no
 * analytics property to report to, and swallowing anchor clicks would hide a
 * broken link from the developer instead of showing it. A theme that renders
 * correctly here renders correctly there — the interception changes navigation,
 * not markup.
 */
</script>

<template>
    <router-view />
</template>
