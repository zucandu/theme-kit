<script setup>
/**
 * A price in a NAMED currency, used where the row carries its own code — an
 * order placed in one currency stays in that currency however the shopper
 * switches the storefront.
 *
 * Symbol placement follows the currency's own `position` field, because it is
 * data, not a rule: some currencies sit left, some right.
 */
import { computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';

const settingsStore = useSettingsStore();

const props = defineProps({
    price: { type: [Number, String], required: true },
    currencyCode: { type: String, required: true },
});

const currency = computed(() => settingsStore.findCurrencyByCode(props.currencyCode));

const amount = computed(() => {
    const digits = currency.value?.decimal_digits ?? 2;
    return (+props.price).toFixed(digits).replace(/\d(?=(\d{3})+\.)/g, '$&,');
});
</script>

<template>
    <span class="display-price-with-currency">
        <span v-if="currency?.position === 'l'">{{ currency.symbol }}{{ amount }}</span>
        <span v-else-if="currency">{{ amount }}{{ currency.symbol }}</span>
        <span v-else>___</span>
    </span>
</template>
