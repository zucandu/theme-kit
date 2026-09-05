/**
 * "Notify me when back in stock" / "available on request" modal.
 *
 * The modal opens and closes for real so it can be styled. The signup goes
 * nowhere, and the copy is fixed text rather than anything derived.
 *
 * 🚨 `selectedProductName` is a FUNCTION, not a ref — the theme calls it as
 * `selectedProductName()`. Shipping it as a ref compiled and type-checked
 * cleanly, then threw at render.
 *
 * `isStockOnRequestProduct` reads the product's own flag so both card states
 * (add-to-cart vs request form) show up naturally in a listing. It is the only
 * decision in this file, and it is a flag read, not a rule.
 */
import { ref } from 'vue';

const isRestockModalOpen = ref(false);
const selectedProduct = ref(null);
const submitting = ref(false);
const restockForm = ref({ email: '', name: '', product_id: null });

const COPY = {
    heading: 'Back in stock alert',
    body: 'We will email you as soon as this item is available again.',
    cta: 'Notify me',
    success: 'You are on the list.',
};

export function isStockOnRequestProduct(product) {
    return Number(product?.stock_on_request) === 1;
}

export function useRestockModal() {
    return {
        isRestockModalOpen,
        selectedProduct,
        submitting,
        restockForm,
        restockCopy: ref(COPY),
        isStockOnRequest: ref(false),

        openRestockModal: (product) => {
            selectedProduct.value = product ?? null;
            isRestockModalOpen.value = true;
        },

        closeRestockModal: () => {
            isRestockModalOpen.value = false;
        },

        selectedProductName: () => selectedProduct.value?.translations?.[0]?.name ?? '',

        copyForProduct: () => COPY,

        restockNotify: async () => ({ data: {} }),
    };
}
