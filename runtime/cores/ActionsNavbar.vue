<script setup>
import { computed } from 'vue';
import { useHelpers } from '@/composables/useHelpers';

const props = defineProps({
    url: String,
    query: Object,
    saving: Boolean,
    // Blocks Save for a reason that is NOT an in-flight save, so the button greys
    // out without claiming to be saving. Added for T54.12, where the order form must
    // not submit totals it is currently re-asking the server for. Optional and
    // false by default — every existing call site keeps its behaviour.
    disabled: Boolean,
});

const { getUrlParams } = useHelpers();

const discardQuery = computed(() => {
    return props.query === undefined ? getUrlParams() : props.query;
});
</script>

<template>
    <div class="fixed top-0 left-0 w-full border-b border-gray-200/60 bg-white/80 backdrop-blur-md shadow-md dark:bg-slate-800/90 dark:border-slate-600/60 dark:shadow-slate-950/30 z-10000 h-16 flex items-center transition-colors duration-200">
        <div class="container mx-auto px-4">
            <div class="flex justify-center">
                <div class="w-full max-w-(--breakpoint-xl)">
                    <nav class="flex items-center justify-end">
                        <div class="flex items-center gap-3">
                            <router-link
                                class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-all duration-150 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:border-gray-500 dark:active:bg-gray-600 cursor-pointer"
                                :to="{ path: url, query: discardQuery }"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="shrink-0" viewBox="0 0 16 16">
                                    <path fill-rule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5z" />
                                </svg>
                                {{ $t('Discard') }}
                            </router-link>
                            <button
                                :disabled="saving || disabled"
                                class="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg text-white bg-green-600 shadow-sm shadow-green-600/25 hover:bg-green-700 hover:shadow-md hover:shadow-green-700/30 active:bg-green-800 active:shadow-none dark:bg-green-600 dark:shadow-green-600/20 dark:hover:bg-green-500 dark:hover:shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-150 cursor-pointer"
                                type="submit"
                            >
                                <div v-if="saving">
                                    <svg class="-ml-0.5 size-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                </div>
                                <svg v-else xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="-ml-0.5 size-4">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                                {{ $t('Save') }}
                            </button>
                        </div>
                    </nav>
                </div>
            </div>
        </div>
    </div>
</template>
