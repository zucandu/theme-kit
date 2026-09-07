# CLAUDE.md — Zucandu Theme Kit

Offline development kit for the Zucandu v3 storefront. It runs a **theme** against
**fixtures**, with a **shim** standing in for the platform. No store, no network.

---

## What a theme is

A storefront theme is exactly two entries:

```
Storefront.vue      the shell
storefront/         every page, plus components/ and css/
```

Nothing else. In particular **`cores/` is NOT part of a theme package** — it is
shared by every theme and replaced wholesale on each store update, so it is not a
theme developer's to edit and does not ship in their zip. The kit supplies its own
copies in `runtime/cores/`.

`bin/zuc-theme.mjs` enforces exactly this pair (`REQUIRED`), and `zuc-theme export`
nests exactly this pair under `files/`.

## The reference theme

```
D:\laragon\www\v3\resources\js\components\themes\default
```

**Test the kit against this one.** It is the default v3 theme and the only theme
whose behaviour is the platform's baseline.

🚨 **Never edit anything under `D:\laragon\www\v3`.** It is a read-only reference —
the source of truth to consult, not a workspace. Work against a COPY:

```bash
cp    "D:/laragon/www/v3/resources/js/components/themes/default/Storefront.vue" theme/
cp -r "D:/laragon/www/v3/resources/js/components/themes/default/storefront"     theme/
node bin/zuc-theme.mjs dev theme
```

`theme/` is gitignored, so the copy is disposable — refresh it from v3 whenever the
platform theme moves.

Other themes on this machine (e.g. `heads22v3` on the Desktop) are **customer
themes**. They are fine for spot checks but must not be the basis for a kit change:
they carry components and imports the default theme does not have, so a failure
there may be the theme's problem, not the kit's.

## The platform source — the source of truth

```
D:\laragon\www\v3\resources\js
  stores/          the real Pinia stores the shim replaces
    auth/customer.js  cart.js  order.js  settings.js  wishlist.js
    catalog/listing.js  catalog/product.js
    utils/{banner,contact,menu,post}.js
    payments/{braintree,moneyorder,paypal,square,stripe}.js
  composables/     the real composables the shim replaces
  services/        the real api.js
  router-storefront.js   the real route table (names are load-bearing)
```

`shim/` exists to mirror these. **When a shape is in question, read the v3 file** —
do not infer it from a theme's call site, and do not infer it from the built bundle
on a live store. Read only; fixes land in `shim/`, never in v3.

🚨 A live store's bundle can LAG this source. `demo-store.zucandu.com` was checked
across all 77 of its chunks for `useSchematicSvgLoader` and had zero hits, which
looked like proof the composable did not exist. It does exist, right here in
`composables/`. The deployed build was simply older. A missing symbol in a shipped
bundle proves nothing about the platform.

## Rules that keep the kit honest

- **A theme file is never edited to make it run here.** The whole promise is
  "upload it and it works", which only holds if the theme runs byte for byte. The
  aliases do the work: `@` → `shim/`, `@theme` → the theme folder.
- **Route names in `runtime/router.js` must match the platform exactly.** Themes
  navigate by name; a renamed route makes a broken link look fine locally.
- **Fixtures come from real responses.** `tools/capture-fixtures.mjs` pulls the
  public ones. Authenticated shapes (profile, orders) are not public — capture them
  by hand with a token and **scrub the identity values** before committing; this
  repo is public MIT.
- **The kit must render the page.** This package exists so a theme developer can
  see and style every screen. A shim action that refuses to pretend — leaving a
  page unreachable or a branch permanently empty — has failed at its job. Return a
  constant and move on.

## Windows: keep the kit and the theme on one drive

Both are on `D:` here, which is the working case. Across drives, `dev` 404s every
page and `build` **silently compiles no page components at all** while still
printing `✓ built`. `bin/zuc-theme.mjs` refuses both rather than let that pass.

## Commands

```bash
node bin/zuc-theme.mjs dev theme      # hot-reloading dev server on :5180
node bin/zuc-theme.mjs build theme    # must pass before shipping a change
node bin/zuc-theme.mjs check theme    # is this folder a runnable theme?
node bin/zuc-theme.mjs export theme   # assemble the uploadable package
node tools/capture-fixtures.mjs       # re-pull public fixtures
```

There is no lint and no test suite. `build` plus a browser pass is the check.
