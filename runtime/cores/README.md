# cores/ — platform-owned, not part of a theme package

A theme package is `Storefront.vue` plus `storefront/`. That is all the platform's
installer reads, and all it writes back.

`cores/` is different. It is shared by every theme and replaced wholesale on every
store update (`rm -rf cores && cp -a` from the platform source), so an edit a
theme developer makes there survives exactly until the next update and then
disappears. It is not yours to change, and it does not ship in your package.

The kit therefore supplies its own copies here rather than expecting them in your
theme folder. They are minimal stand-ins with the same names, props and slots as
the platform's — enough to render and lay out against, not the real thing.

`<LocalizedLink>` alone appears 88 times in the default theme with no import
anywhere; miss these and a theme does not render one page.
