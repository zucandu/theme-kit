/**
 * JSON-LD structured data.
 *
 * `trustedJsonLd` returns the payload untouched. On the platform it passes
 * through a Trusted Types policy before reaching the DOM — a browser control
 * that only engages under the CSP a live store sends, which localhost does not
 * have. Wrapping it here would imply a protection the kit is not providing.
 *
 * Exported BOTH as a named binding and from the factory, matching the platform:
 * Breadcrumb.vue imports the binding directly.
 */
export const trustedJsonLd = (json) => json;

export function useTrustedJsonLd() {
    return { trustedJsonLd };
}
