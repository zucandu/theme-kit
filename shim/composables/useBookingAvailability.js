/**
 * Booking calendar availability.
 *
 * Answers the platform's contract with the emptiest response a real store can
 * give: nothing unavailable, nothing partial, a horizon 12 months out. That is
 * not an invention — it is exactly what
 * `GET /booking/availability?product_id=&year=&month=` returns for a bookable
 * product that has no bookings against it and no blackout dates, which is the
 * state the captured booking fixture is in.
 *
 * So every day is selectable and a theme can lay out a picked range, a hover
 * range, the horizon bound and the two-month view. What the kit cannot show is
 * a calendar with holes in it — availability is a server calculation over
 * capacity and existing orders, and a made-up scatter of blocked days would let
 * a theme be tuned to a pattern no store produces.
 *
 * 🚨 The previous version returned `{ days, available, blocked }`. No endpoint
 * has ever answered that shape, and `getCached()` returned null forever, so the
 * cache the modal actually reads from was never written. It rendered — by
 * accident, because an absent month reads as "nothing blocked" — but a theme
 * that used `loadMonth()`'s return value, which the platform does populate, got
 * three keys that do not exist and no `unavailable_dates` at all.
 */
import { ref, shallowRef } from 'vue';

/** Inclusive last bookable day, mirroring the platform's rolling horizon. */
const horizonDate = () => {
    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + 12);
    return horizon.toISOString().slice(0, 10);
};

export function useBookingAvailability(productId) {
    const cache = shallowRef(new Map());
    const loading = ref(false);
    const error = ref(null);
    const horizonMaxDate = ref(horizonDate());

    const key = (year, month) => `${productId}:${year}-${String(month).padStart(2, '0')}`;

    const getCached = (year, month) => cache.value.get(key(year, month)) ?? null;

    /** The month payload, in the shape BookingCalendarModal reads. */
    const monthData = () => ({
        unavailable_dates: [],
        partial_dates: [],
        horizon_max_date: horizonMaxDate.value,
    });

    // Map identity is rebuilt rather than mutated, because the modal's computeds
    // track the shallowRef and would never see a nested write.
    function remember(year, month) {
        const data = monthData();
        const next = new Map(cache.value);
        next.set(key(year, month), data);
        cache.value = next;
        return data;
    }

    return {
        loading,
        error,
        horizonMaxDate,
        loadMonth: async (year, month) => getCached(year, month) ?? remember(year, month),
        prefetchMonth: async (year, month) => {
            if (!getCached(year, month)) remember(year, month);
        },
        getCached,
        invalidate: (year, month) => {
            const next = new Map(cache.value);
            next.delete(key(year, month));
            cache.value = next;
        },
    };
}
