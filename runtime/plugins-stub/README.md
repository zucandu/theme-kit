Stub for the `@storefront-plugins` alias.

Storefront plugin addons are installed per store, so a theme has to render with
none present. `routes.js` globs `addons/*.vue` and `account/*.vue` here; both
folders stay empty on purpose, and an empty glob yields zero extra routes —
the same state a freshly provisioned store is in.

Drop a `.vue` file into either folder to preview how a theme behaves once a
store installs an app that adds a page.
