/**
 * Checkout coupon field.
 *
 * Opens as an EMPTY FIELD, and applying any code succeeds. Both states matter and
 * both are one click apart: type anything, apply, and the field is replaced by the
 * applied row with a Remove button; remove, and the field is back.
 *
 * Nothing is validated. Whether a coupon exists, has expired or meets its minimum
 * is a store's decision, and there is no store here.
 *
 * The applied coupon is pushed into the order store's `checkoutSelections.discounts`
 * as well as tracked here, because that array is what the order summary renders its
 * discount row from. Setting one without the other would show an applied coupon
 * with no discount line, or the reverse.
 *
 * `hasCouponModule` is true so the field always renders. On a live store it is
 * false until the merchant installs a discount module — do not assume the field is
 * always there.
 */
import { ref } from 'vue';
import checkout from '../../fixtures/checkout.json';
import { useOrderStore } from '@/stores/order';

export function useCheckoutCoupon() {
    const orderStore = useOrderStore();

    const couponCode = ref('');
    const appliedCoupon = ref(null);
    const couponError = ref('');
    const couponLoading = ref(false);

    const applyCoupon = async () => {
        couponError.value = '';

        const coupon = {
            ...checkout.applied_coupon,
            code: couponCode.value.trim() || checkout.applied_coupon.module,
        };

        appliedCoupon.value = coupon;
        orderStore.checkoutSelections.discounts = [coupon];
    };

    const removeCoupon = async () => {
        appliedCoupon.value = null;
        couponCode.value = '';
        orderStore.checkoutSelections.discounts = [];
    };

    return {
        couponCode,
        appliedCoupon,
        couponError,
        couponLoading,
        hasCouponModule: ref(true),
        applyCoupon,
        removeCoupon,
    };
}
