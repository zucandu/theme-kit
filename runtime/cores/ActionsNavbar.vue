<script setup>
/**
 * The fixed save/discard bar on editable account pages.
 *
 * Discard navigates back to `url`; save only emits — there is nothing to persist
 * offline, and the theme decides what the button does.
 */
defineProps({
    url: String,
    query: Object,
    saving: Boolean,
    disabled: Boolean,
});

defineEmits(['save']);
</script>

<template>
    <div class="fixed top-0 left-0 z-50 flex h-16 w-full items-center border-b border-gray-200/60 bg-white/80 backdrop-blur-md">
        <div class="container mx-auto flex justify-end gap-3 px-4">
            <router-link
                v-if="url"
                :to="{ path: url, query }"
                class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
                Discard
            </router-link>
            <button
                type="button"
                :disabled="disabled || saving"
                class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                @click="$emit('save')"
            >
                {{ saving ? 'Saving…' : 'Save' }}
            </button>
        </div>
    </div>
</template>
