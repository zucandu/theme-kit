<script setup>
/**
 * A product's price, showing the original struck through when it is on sale.
 *
 * Reads the price straight off the product row — no tax, no rate conversion. A
 * live store's figure comes from its own pricing rules.
 */
import { computed } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { useProductStore } from '@/stores/catalog/product';
import { useHelpers } from '@/composables/useHelpers';

const settingsStore = useSettingsStore();
const productStore = useProductStore();
const { formatCurrency } = useHelpers();

const props = defineProps({
    product: { type: Object, required: true },
    qty: { type: Number, default: 1 },
});

const formattedPrice = computed(() => {
    const currency = settingsStore.selectedCurrencyObject;
    const price = productStore.finalizeProductPrice(props.product);
    const money = (v) => formatCurrency(v * (props.qty || 1), currency.decimal_digits, currency.code);

    return {
        original: money(+price.retail || 0),
        discounted: +price.sale > 0 ? money(+price.sale) : null,
    };
});
</script>

<template>
    <div class="inline">
        <template v-if="formattedPrice.discounted">
            <span class="text-gray-500 line-through">{{ formattedPrice.original }}</span>
            <span class="ml-2 text-red-600">{{ formattedPrice.discounted }}</span>
        </template>
        <span v-else>{{ formattedPrice.original }}</span>
    </div>
</template>
