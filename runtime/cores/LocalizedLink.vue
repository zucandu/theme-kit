<script setup>
/**
 * A router-link that prefixes the active language.
 *
 * Accepts a string path or a route object, because themes pass both. The
 * language prefix is empty in the kit (one locale), so this is close to a plain
 * router-link — the normalising is what keeps `//double//slashes` out of hrefs
 * built from menu data.
 */
import { computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';

const settingsStore = useSettingsStore();

const props = defineProps({
    to: { type: [String, Object], required: true },
    label: { type: String, default: 'Click here' },
});

const clean = (path) => `/${String(path).replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/')}`;

const computedTo = computed(() => {
    const prefix = settingsStore.languagePrefix;

    if (typeof props.to === 'string') return `${prefix}${clean(props.to)}`;
    if (props.to && props.to.path) return { ...props.to, path: `${prefix}${clean(props.to.path)}` };

    return props.to ?? '/';
});
</script>

<template>
    <router-link :to="computedTo">
        <slot>{{ label }}</slot>
    </router-link>
</template>
