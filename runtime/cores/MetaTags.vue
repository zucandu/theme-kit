<script setup>
/**
 * Sets the document title so pages are distinguishable in the browser tab.
 * Renders nothing. Canonical, robots and OG tags matter to crawlers, and nothing
 * crawls localhost.
 */
import { onMounted, watch } from 'vue';

const props = defineProps({
    title: { type: String, required: false },
});

const apply = () => {
    if (props.title) document.title = props.title;
};

onMounted(apply);
watch(() => props.title, apply);
</script>

<template><div></div></template>
