/**
 * Booking purchase panel — the date/duration selection on a bookable product.
 *
 * Mirrors the platform's composable of the same name. Everything here except the
 * SERVER QUOTE is real: the picker's price delta is computed in the browser on a
 * live store too, so choosing "Deluxe Room — $40.00" moves the displayed price
 * exactly as it will after upload. `bookingQuote` stays null, which is the same
 * fall-back the platform takes before its first quote lands — count 1, subtotal
 * = unit price. What the kit cannot show is a multi-night total, because that
 * number is BookingPriceCalculator's and it needs a store.
 *
 * 🚨 This used to return frozen `computed`s for every value, including
 * `bookingHasFkPair: false`. Two things were wrong with that, and neither could
 * be seen until this kit had a booking fixture to render:
 *
 *   - `bookingPriceDelta` and `bookingHasMissingRequired` are WRITTEN by the
 *     theme (`@update:priceDelta="bookingPriceDelta = $event"`). Assigning to a
 *     computed is a readonly write: Vue warns and drops it, so the picker could
 *     never move the price and the ADD TO CART button could never gate on a
 *     missing required field.
 *   - `bookingHasFkPair` decides whether the qty stepper renders. Hardcoding it
 *     false showed a stepper on a product whose FK pair IS configured — the one
 *     shape a real configured booking never has.
 *
 * So it is derived from the product now, the same expression the platform uses.
 */
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

export function useBookingPurchase(productComputed, formdata, baseUnitPrice) {
    const { t } = useI18n();

    // The platform reads a saved selection back out of the cart when the shopper
    // returns from /cart via `?cart_row=`. The kit's cart holds no booking rows,
    // so the picker always opens on its own defaults.
    const initialBookingSelection = computed(() => ({}));

    const bookingPriceDelta = ref(0);
    const bookingSelection = ref({});
    const bookingHasMissingRequired = ref(false);

    // Null forever: a quote is BookingPriceCalculator's answer, and inventing one
    // would put a total on screen that no store would agree with. The computeds
    // below all carry the platform's own pre-quote fall-back.
    const bookingQuote = ref(null);

    const bookingUnitPrice = computed(() => baseUnitPrice.value + (bookingPriceDelta.value || 0));

    // Configured booking = the admin picked a start date field. The end field is
    // optional (null = single-date service, set = check-in/check-out range).
    const bookingHasFkPair = computed(() => {
        const p = productComputed.value?.productData;
        return p?.type === 'booking' && p?.booking_start_attribute_option_id != null;
    });

    const bookingCount = computed(() => bookingQuote.value?.count ?? 1);
    const bookingCountUnit = computed(() => bookingQuote.value?.count_unit ?? 'night');
    const bookingSubtotal = computed(() => bookingQuote.value?.subtotal ?? bookingUnitPrice.value);

    const bookingDisplayPrice = computed(() => {
        if (bookingHasFkPair.value) return bookingSubtotal.value;
        return bookingSubtotal.value * (formdata.value.qty > 0 ? formdata.value.qty : 1);
    });

    const bookingCountUnitLabel = computed(() => {
        const c = bookingCount.value;
        const u = bookingCountUnit.value;
        if (u === 'day') return c === 1 ? t('day') : t('days');
        if (u === 'hour') return c === 1 ? t('hour') : t('hours');
        return c === 1 ? t('night') : t('nights');
    });

    return {
        initialBookingSelection,
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
        bookingCountUnitLabel,
    };
}
