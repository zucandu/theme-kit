/**
 * Checkout coupon field.
 *
 * Starts ALREADY APPLIED, on purpose. The applied block is the state a theme is
 * most likely to ship unstyled — it only appears after a successful redemption,
 * which is easy never to reach while designing. Opening on it means you see it
 * without hunting for it; the remove button gets you back to the empty field, so
 * both states are one click apart.
 *
 * Any code is accepted and none is ever rejected. Whether a coupon is valid is a
 * store's decision, and there is no store here.
 *
 * `hasCouponModule` is true so the field always renders. On a live store it is
 * false until the merchant installs a discount module — do not assume the field
 * is always there.
 */
import { ref } from 'vue';
import checkout from '../../fixtures/checkout.json';

export function useCheckoutCoupon() {
    const couponCode = ref('');
    const appliedCoupon = ref(checkout.applied_coupon);

    return {
        couponCode,
        appliedCoupon,
        couponError: ref(''),
        couponLoading: ref(false),
        hasCouponModule: ref(true),

        applyCoupon: async () => {
            appliedCoupon.value = checkout.applied_coupon;
        },

        removeCoupon: async () => {
            appliedCoupon.value = null;
            couponCode.value = '';
        },
    };
}
