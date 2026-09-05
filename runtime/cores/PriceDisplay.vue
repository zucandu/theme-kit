<script setup>
/**
 * A price in the active currency.
 *
 * The platform destructures `selectedCurrencyObject` without a guard, which is
 * why the settings shim never returns undefined for it.
 */
import { computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { useHelpers } from '@/composables/useHelpers';

const settingsStore = useSettingsStore();
const { formatCurrency } = useHelpers();

const props = defineProps({
    price: { type: [Number, String], required: true },
});

const display = computed(() => {
    const currency = settingsStore.selectedCurrencyObject;
    return formatCurrency(props.price, currency.decimal_digits, currency.code);
});
</script>

<template>
    <div>{{ display }}</div>
</template>
