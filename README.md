# Zucandu Theme Kit

Build and preview a Zucandu v3 **storefront theme** on your own machine — no store,
no database, no network, and no platform source code.

Point the kit at a theme folder and it runs, hot-reloading, against a set of
captured API responses. When the theme looks right, upload it: nothing in your
files was changed to make it run here, so nothing has to change to make it run
there.

---

## Quick start

**You need** Node 20 or newer. Nothing else — no PHP, no database, no store.

```bash
git clone https://github.com/zucandu/theme-kit.git
cd theme-kit
npm install
```

Then point the kit at your theme. **Your theme does not have to live inside this
folder** — either layout works:

```bash
# A. theme somewhere else on disk (usually its own git repo)
npx zuc-theme dev ../my-theme
npx zuc-theme dev /Users/me/work/acme-theme

# B. theme dropped inside the kit, at theme-kit/theme/
npx zuc-theme dev
```

Open **http://localhost:5180**.

The theme folder is the one containing **`Storefront.vue` and `storefront/`** —
the same layout your theme package unzips to, and the only two things the
platform's installer reads. Not sure? Ask first:

```bash
npx zuc-theme check ../my-theme
```

Option A is the usual one: a theme is its own project with its own history, and
the kit is just a tool you run against it. Option B is simply less to type —
`theme/` is gitignored here, so it never lands in the kit's repo.

> **`cores/` is not yours.** Those shared components (`<LocalizedLink>`,
> `<PriceDisplay>`, …) belong to the platform: they are replaced wholesale on every
> store update, so an edit there survives until the next update and then vanishes.
> They are not in your package and the kit does not expect them — it supplies its
> own copies.

> **Windows:** the kit and the theme must be on the **same drive** — for `dev`
> *and* for `build`. `dev` breaks because Vite serves files outside its root
> through `/@fs/`, and that URL loses the separator after a drive letter, so every
> page 404s. `build` breaks more quietly: pages are reached through a globbed
> dynamic import, that glob matches nothing across drives, and the build then
> *succeeds* having compiled no page at all — measured at 77 chunks on one drive
> against 5 and no pages on another, both printing `✓ built`. The CLI stops with an
> explanation rather than letting either happen. If your theme lives on another
> drive, copy it to `theme-kit/theme/` (gitignored) and run the commands with no
> path.

---

## Working on a theme

1. **Edit any file in your theme folder.** The browser updates as you save; the
   kit never writes to your theme.
2. **Watch the console.** Anything the kit cannot answer is logged once, prefixed
   `[theme-kit] offline`. An empty section with that line next to it is a missing
   fixture, not a bug in your markup.
3. **Build before you ship.**
   ```bash
   npx zuc-theme build ./path/to/your-theme
   ```
   This is the cheapest way to catch a typo'd import or a renamed component. It
   fails loudly, by file and line, where the dev server only warns.
4. **Upload the theme folder** to your store. You changed nothing to make it run
   locally, so there is nothing to undo.

### Commands

| Command | What it does |
|---|---|
| `zuc-theme dev <theme-dir>` | Dev server with hot reload, port 5180 |
| `zuc-theme build <theme-dir>` | Production build — proves the theme compiles |
| `zuc-theme check <theme-dir>` | Verifies the folder is a runnable theme |

---

## How it works

A theme file addresses the platform only through the `@` alias
(`@/stores/cart`, `@/composables/useHelpers`) and its own files through `@theme`.

The kit points `@` at its own `shim/` folder — 23 modules with the **same paths
and the same exported names** as the platform's, each returning a captured JSON
fixture or a plain constant — and points `@theme` at your theme folder. Your files
compile byte for byte as written.

On a live store those same imports resolve to the real platform modules, and the
theme behaves for real.

---

## What you can use, and what you cannot

The kit does not simulate the platform. Almost everything under `shim/` returns a
fixture or a fixed value, and nothing is calculated at runtime. That line is drawn
on purpose: an approximation that moves convincingly is worse than an obvious
placeholder, because a theme laid out against plausible-but-wrong numbers looks
finished while being wrong.

### Trust it — behaves as it will on a store

- **Routing and navigation.** Route names, params, nested routes, `?redirect=`.
- **Your whole component tree.** Every template, every style, every breakpoint.
- **Catalogue content.** Products, categories, search results, menus, blog posts —
  all captured from live stores, with real names, prices, images and translations.
- **Add to cart / wishlist.** Adds the product you clicked, so a mis-wired button
  still shows up as a mis-wired button.
- **Signing in and out.** You start signed out, so the guest header, the login form
  and every "sign in to continue" branch are reachable.
- **The states your theme owns.** Modals, drawers, accordions, tabs, skeletons.

### Do not trust it — placeholder, and different on a live store

| Here | On a live store |
|---|---|
| cart totals never move | recalculated server-side on every change |
| tax is one fixed figure from the shipping address | calculated per destination, and often **0** |
| every variant resolves to the same child product | each combination is its own product |
| filters, sorting and pagination return the same page | a real query |
| the coupon field starts applied and accepts anything | validated, and absent without a discount module |
| payment is Check/Money Order only | whatever the merchant installed — possibly **none** |
| shipping is two fixed rates | live carrier quotes — possibly **none** |
| any email and password signs you in | a real session, validated |
| app hook slots are always empty | filled where a merchant installed an app |
| prices convert by symbol only | converted by the store's live rates |

### The four that catch themes out

1. **Empty shipping and payment lists.** A freshly provisioned store has neither.
   Give both an empty state, or your checkout is a blank panel on day one.
2. **The tax row.** It is hidden below zero. Design the page with it *and* without
   it — set `totals.tax` to `0` in `fixtures/checkout.json` to see the other one.
3. **Missing app hooks.** Hooks only exist where a merchant installed an app, so
   the slots are always empty here — a layout that only looks right once a hook
   fills a gap is broken on every store that has not installed it. The reverse
   costs more: a hook point your theme never renders shows **nothing**, with no
   error in the admin and none in the app's logs, so the merchant reports it as a
   broken app. See
   [Adding app hook points to a theme](https://help.zucandu.com/article/adding-app-hook-points-to-a-theme).
4. **The signed-out visitor.** A theme that only looks right signed in is broken
   for every first-time visitor.

Nothing here places an order, sends mail, or contacts a payment gateway.

### Not included at all

**Admin.** The kit is storefront-only by design — `adminApi` is deliberately
absent, so a theme file reaching for it fails at import here rather than with a
403 on a live store.

---

## JavaScript libraries

**Do not add a `<script src>`, a `loadScript()` call, or any CDN URL.** A script
from an unapproved host is refused on every store — the request is never sent, the
page still renders, and the part it powered silently does nothing. Nothing on
screen says why.

The platform ships a set of libraries instead. Import them by name; there is
nothing to download, bundle or declare:

```js
import EmblaCarousel from 'embla-carousel'
```

**This kit installs exactly that set**, so what builds here builds on a store:

`@headlessui/vue` · `@heroicons/vue` · `lucide-vue-next` · `chart.js` ·
`vue-chartjs` · `dompurify` · `qrcode` · `vuedraggable` · `vue-toastification` ·
`dropzone` · `prismjs` · `vue-router` · `vue-i18n` · `pinia` ·
`embla-carousel` · `embla-carousel-autoplay` · `@panzoom/panzoom`

Need something else? Ask for it to be added to the platform — a library is
requested once, ever, not once per theme. Locally you can install anything and
build freely; the check happens when the theme is installed on a real store, so
have it added before you submit.

Full rules, including vendor SDKs and the separate allow-list for CSS imports:
[JavaScript libraries you can use in a theme](https://help.zucandu.com/article/theme-javascript-libraries).

> If you add a library here that the platform does not ship, the kit stops telling
> you the truth: it builds locally and fails on the store. Keep this list and
> `package.json` in step.

---

## Signing in

You start signed out. Type **any** email and **any** password and you are in, with
the dummy profile in `fixtures/customer.json` — Tester Tester, two US addresses.
Nothing is validated, because validation is a store's job.

Pages marked `requiresAuth` (the account area, checkout) send a signed-out visitor
to the login form carrying `?redirect=`, exactly as the platform does — so that
path is stylable too. The session lives in localStorage, so a reload keeps you in
and `/logout` really does put you back to the guest state.

The account navigation comes from `fixtures/menus.json` under the `account` key —
the same seven entries a store gets on install (Orders, Quick Reorder, Profile,
Address Book, Wishlist, Back in stock, Update Password). Edit it to see how your
theme handles a longer or shorter list; a merchant can change it.

## Tax

The account carries two addresses, and only one is taxable:

| | Address | Tax |
|---|---|---|
| Shipping (default) | 7250 Bollinger Rd, San Jose, CA 95129 | 9.375% → an **$8.25** Sales Tax line |
| Billing | 40 N. 36th St., Camp Hill, PA 17011 | none |

That asymmetry is deliberate — see point 2 above. The figure never moves: it is
not recalculated when you change the shipping method or the destination.

> `zucConfig.product_price_with_tax` is the string `'n'`, not a number. The order
> details page tests it as a string; a numeric `0` silently hides the tax row and
> nothing warns you.

## Configuring

Drop a `theme-kit.config.json` next to your theme:

```json
{
  "locale": "en",
  "fixtureOrigin": "https://demo-store.zucandu.com",
  "zucConfig": {
    "store_name": "My Store",
    "number_of_items_per_block": 4,
    "small_image_size": 60,
    "medium_image_size": 280,
    "large_image_size": 600
  }
}
```

- **`zucConfig`** overrides any store-config key a theme reads.
- **`fixtureOrigin`** is where imagery is fetched from; `null` works fully offline
  against placeholders.
- **`locale`** picks the active language. Per-theme translations are optional:
  `<theme-dir>/locales/<code>.json` is picked up automatically. Without one the
  storefront still reads correctly — the platform keys translations by the English
  phrase itself, so a missing message renders as that phrase.

⚠️ **The three image sizes are not decorative.** Themes build image URLs as
`/storage/<size>/<file>`, and only sizes a store has actually generated exist. Set
one no store generates and every product image 404s.

---

## Refreshing the fixtures

Fixtures come from two public stores, because neither has everything a theme needs
to be judged: the demo store has the catalogue, the main site has a real set of
articles (the demo carries two, both legal pages).

```bash
node tools/capture-fixtures.mjs                                  # both defaults
node tools/capture-fixtures.mjs https://your-store.example.com
node tools/capture-fixtures.mjs https://your-store.example.com https://your-blog.example.com
```

Only public storefront endpoints are read — catalogue, settings, menus, blog.
Nothing touching a customer, an order or an admin session is captured, which is
why the customer, cart, order and checkout fixtures are **authored**: those
endpoints need a session, and this package is public. Their field names still come
from the theme's own templates rather than a guess.

Two things the capture protects, because both fail silently otherwise:

- **A hand-authored menu is never overwritten by a null.** Not every store defines
  every menu — the demo has no account menu, so `/menu/account` answers
  `{"menu": null}`. Treating that as a correction would empty the account sidebar.
- **The product is pinned to the previous run.** `/product/spotlight` rotates, and
  `product-variants.json` is derived from ONE product. If they ever disagree the
  capture says so loudly; the picker would otherwise show another product's
  options with no error anywhere.

> Recapturing against your own store? Read the output before committing it.
> Catalogue data is business data.

### Images

`/storage` and `/images` are served by trying each fixture origin in turn, then
falling back to a placeholder. Two origins, because product and article imagery
live on different hosts while both are addressed by the same store-relative path.
Read-only image traffic only — no API call is ever forwarded.

## Keeping in step with the platform

`contract.json` lists every platform module a theme touches and every member it
uses. Regenerate it against any theme with:

```bash
node tools/extract-surface.mjs <theme-dir>
```

It is a static scan, so it sees imports and property access — not everything. The
authoritative check is still `zuc-theme build`: a missing export fails the build by
name and file.

**A shim is a promise about shape.** If the platform changes what a store returns
and the kit is not updated, a theme can look finished here and break once uploaded.
Treat a kit version as paired with a platform version, and rebuild your theme
against a fresh kit before you ship.

## Further reading

- [JavaScript libraries you can use in a theme](https://help.zucandu.com/article/theme-javascript-libraries)
- [Adding app hook points to a theme](https://help.zucandu.com/article/adding-app-hook-points-to-a-theme)
- [Adding a storefront page from an app](https://help.zucandu.com/article/adding-a-storefront-page-from-an-app)

## License

MIT — see [LICENSE](LICENSE).
