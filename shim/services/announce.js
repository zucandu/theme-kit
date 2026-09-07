/**
 * Say out loud that a write reached the platform.
 *
 * On a live store these actions POST and the server answers with a new cart, a
 * new order, a saved wishlist. Here they change a fixture in memory, or nothing
 * at all — so a theme developer clicking ADD TO CART has no way to tell a wired
 * button from a dead one. An alert is blunt on purpose: it cannot be missed, and
 * it is not the theme's own toast, so the two do not get confused.
 *
 * Deliberate submits only. Anything that fires repeatedly — the qty stepper, a
 * filter, a live quote — is left silent.
 */
export const announce = (action) => {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(`[theme-kit] ${action}\n\nThis reached the platform. Fixture data does not change.`);
    }
};
