/**
 * Booking purchase panel — the date/duration selection on a bookable product.
 *
 * The picker's own surcharge is real: it is worked out in the browser on a live
 * store too, so choosing a $40 room really does move the price here. The QUOTE
 * is not — a duration total is the platform's to calculate, so `bookingQuote`
 * stays null and the count falls back to 1.
 *
 * 🚨 The three values the theme WRITES have to be refs. They were computeds
 * once, and a write to a computed is dropped with a warning — so the picker
 * could not move the price and ADD TO CART could not gate on a missing field.
 */
import { ref, computed } from 'vue';

/** Singular, because the kit's count is always 1. */
const UNIT_LABEL = { night: 'night', day: 'day', hour: 'hour' };

export function useBookingPurchase(productComputed, formdata, baseUnitPrice) {
    const bookingPriceDelta = ref(0);
    const bookingSelection = ref({});
    const bookingHasMissingRequired = ref(false);
    const bookingQuote = ref(null);

    const product = () => productComputed.value?.productData ?? {};

    const bookingUnitPrice = computed(() => baseUnitPrice.value + (bookingPriceDelta.value || 0));

    // Configured booking = the merchant picked a start date field. It decides
    // whether the qty stepper renders, so it cannot be a constant.
    const bookingHasFkPair = computed(
        () => product().type === 'booking' && product().booking_start_attribute_option_id != null
    );

    const bookingCount = computed(() => 1);
    const bookingCountUnit = computed(() => product().booking_unit ?? 'night');
    const bookingSubtotal = computed(() => bookingUnitPrice.value);

    const bookingDisplayPrice = computed(() => (
        bookingHasFkPair.value
            ? bookingSubtotal.value
            : bookingSubtotal.value * (formdata.value.qty > 0 ? formdata.value.qty : 1)
    ));

    return {
        initialBookingSelection: computed(() => ({})),
        bookingPriceDelta,
        bookingSelection,
        bookingHasMissingRequired,
        bookingQuote,
        bookingUnitPrice,
        bookingHasFkPair,
        bookingCount,
        bookingCountUnit,
        bookingSubtotal,
        bookingDisplayPrice,
        bookingCountUnitLabel: computed(() => UNIT_LABEL[bookingCountUnit.value] ?? 'night'),
    };
}
