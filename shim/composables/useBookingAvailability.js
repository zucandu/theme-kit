/**
 * Booking calendar availability.
 *
 * Returns an EMPTY month: every day unavailable, no cached data. Availability
 * is a server calculation over capacity, existing bookings and blackout dates,
 * and inventing a plausible-looking calendar would let a theme be built around
 * a pattern no real store produces.
 *
 * The horizon is a fixed 12 months ahead so date pickers have a bound to render
 * against.
 */
import { ref } from 'vue';

export function useBookingAvailability() {
    const loading = ref(false);
    const error = ref(null);

    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + 12);
    const horizonMaxDate = ref(horizon.toISOString().slice(0, 10));

    const emptyMonth = () => ({ days: {}, available: [], blocked: [] });

    return {
        loading,
        error,
        horizonMaxDate,
        loadMonth: async () => emptyMonth(),
        prefetchMonth: async () => emptyMonth(),
        getCached: () => null,
        invalidate: () => {},
    };
}
