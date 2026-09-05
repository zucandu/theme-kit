/**
 * Payment methods a store has enabled. Mirrors the checkout fixture so the
 * checkout page and any "we accept" footer badge agree with each other.
 */
import { computed } from 'vue';
import checkout from '../../fixtures/checkout.json';

export function useAvailablePaymentMethods() {
    return { availablePaymentMethods: computed(() => checkout.payment_methods) };
}
