<script setup>
/**
 * A postal address block. Falls back from zone code to zone name, because a
 * stored address may carry either.
 */
defineProps({
    address: { type: Object, required: true },
});
</script>

<template>
    <div class="address-card" v-if="address">
        <div v-if="address.name">{{ address.name }}</div>
        <div v-if="address.company">{{ address.company }}</div>
        <div v-if="address.address_line_1">{{ address.address_line_1 }}</div>
        <div v-if="address.address_line_2">{{ address.address_line_2 }}</div>
        <div>{{ address.city }}, {{ address.zone_code || address.zone_name }} {{ address.postcode }}</div>
        <div v-if="address.country_name">{{ address.country_name }}</div>
        <div v-if="address.phone">{{ address.phone }}</div>
    </div>
</template>
