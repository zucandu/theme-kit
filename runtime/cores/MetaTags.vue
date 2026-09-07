<script setup>
import { onMounted, watch } from 'vue';

const props = defineProps({
    title: {
        type: String,
        required: false,
    },
});

function apply() {
    if (props.title) document.title = props.title;
}

onMounted(apply);
watch(() => props.title, apply);
</script>

<template>
    <div></div>
</template>
