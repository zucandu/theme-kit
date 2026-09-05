/**
 * Booking purchase panel — the date/duration selection on a bookable product.
 *
 * Everything is neutral: no dates chosen, nothing missing, no price delta. The
 * quote that fills these in comes from the platform's pricing engine, so the
 * panel renders in its initial state and stays there. That is enough to lay the
 * panel out; it is not enough to verify booking behaviour, which needs a store.
 */
import { ref, computed } from 'vue';

export function useBookingPurchase() {
    const initialBookingSelection = { start: null, end: null, quantity: 1 };
    const bookingSelection = ref({ ...initialBookingSelection });
    const bookingQuote = ref(null);

    return {
        initialBookingSelection,
        bookingSelection,
        bookingQuote,
        bookingCount: computed(() => 0),
        bookingCountUnit: computed(() => 'night'),
        bookingCountUnitLabel: computed(() => 'nights'),
        bookingUnitPrice: computed(() => 0),
        bookingSubtotal: computed(() => 0),
        bookingPriceDelta: computed(() => 0),
        bookingDisplayPrice: computed(() => 0),
        // No pair is selected and nothing required is missing, so the panel opens
        // in a clean state instead of showing a validation error on first paint.
        bookingHasFkPair: computed(() => false),
        bookingHasMissingRequired: computed(() => false),
    };
}
