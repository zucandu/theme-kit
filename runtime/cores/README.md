# cores/ — platform-owned, not part of a theme package

A theme package is `Storefront.vue` plus `storefront/`. That is all the platform's
installer reads, and all it writes back.

`cores/` is different. It is shared by every theme and replaced wholesale on every
store update (`rm -rf cores && cp -a` from the platform source), so an edit a
theme developer makes there survives exactly until the next update and then
disappears. It is not yours to change, and it does not ship in your package.

The kit therefore supplies its own copies here rather than expecting them in your
theme folder. They are **verbatim copies** of the platform's, refreshed with a
plain `cp` from `resources/js/components/themes/default/cores`.

🚨 They used to be minimal stand-ins written to have "the same names, props and
slots". That is not a strong enough guarantee, and all nine had drifted:

- `DisplayAddress` nested its fields one level shallower, so a theme styling
  `.address-card > div` got different results here than on a store.
- `Loading` dropped the platform's `xl:w-4/12 w-full`, so the skeleton was a
  different width at every breakpoint.
- `ActionsNavbar` lost the `discardQuery` computed entirely.
- `StorefrontIframeHook` rendered a `.storefront-hook` div the platform does not.
- `LocalizedLink` was *tidier than the original*, which was the worst of them —
  it accepted two forms the platform mishandles. A bare string became `/cart`
  here and `//cart` on a store; `{ name: 'cart' }` navigated correctly here and
  went to `/` on a store. Both are "works locally, breaks after upload", which is
  the one failure this package exists to prevent.

A stand-in cannot be trusted to stay faithful, and there is no reason to write
one when the real file drops in unchanged. Copy, do not reimplement — including
the platform's own quirks. Reproducing them is what lets a theme developer find
them here instead of after upload; fixing them belongs in the platform.

`<LocalizedLink>` alone appears 88 times in the default theme with no import
anywhere; miss these and a theme does not render one page.
