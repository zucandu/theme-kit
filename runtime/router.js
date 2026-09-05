/**
 * Storefront route table.
 *
 * Route NAMES are load-bearing and must match the platform exactly: theme code
 * navigates by name (`router.push({ name: 'cart' })`) and `<LocalizedLink>`
 * resolves by name. A renamed route here would let a theme link that is broken
 * on a live store look fine locally — the exact class of bug this kit exists to
 * prevent. Paths and nesting mirror the platform for the same reason.
 *
 * Every page component is imported from `@theme/...`, so this file is a
 * manifest, not logic: it lists which of the developer's files answer which URL.
 *
 * One deliberate difference from the platform table: the platform guards
 * /checkout on live stock. Judging a frozen fixture would return one verdict
 * forever, so that guard is dropped rather than faked into always-passing.
 *
 * `meta.requiresAuth` IS enforced, by the guard at the bottom of this file.
 * Signing in accepts any credentials, so the gate costs one click — and without
 * it /account would render against an empty profile, which looks like a broken
 * theme rather than a signed-out visitor.
 */
import { createRouter, createWebHistory } from 'vue-router';

const Storefront = () => import('@theme/Storefront.vue');

const page = (name) => () => import(`@theme/storefront/${name}.vue`);

const addonModules = import.meta.glob('@storefront-plugins/addons/*.vue');
const accountModules = import.meta.glob('@storefront-plugins/account/*.vue');

/** Mirrors the platform's file-name -> route derivation for installed addons. */
const addonRoutes = Object.entries(addonModules).map(([filePath, component]) => {
    const componentName = filePath.split('/').pop().replace(/\.\w+$/, '');
    const path = componentName
        .replace(/\[([^\]]+)\]/g, ':$1')
        .replace(/_/g, '/')
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase();
    return { path, name: componentName, component, props: true };
});

const pluginAccountRoutes = Object.entries(accountModules).flatMap(([filePath, component]) => {
    const componentName = filePath.split('/').pop().replace(/\.\w+$/, '');
    const routerName = (componentName.match(/[A-Z][a-z]*/g) || []).join('-').toLowerCase();
    return routerName ? [{ path: routerName, name: `Account${componentName}`, component }] : [];
});

const accountChildren = [
    { path: 'profile', name: 'account_profile', component: page('AccountProfile') },
    { path: 'order/list', name: 'account_order_list', component: page('AccountOrderList') },
    { path: 'order/:ref', name: 'account_order_details', component: page('AccountOrderDetails') },
    { path: 'quick-reorder', name: 'account_quick_reorder', component: page('AccountQuickReorder') },
    { path: 'password', name: 'account_password', component: page('AccountPassword') },
    { path: 'wishlist', name: 'account_wishlist', component: page('AccountWishlist') },
    { path: 'back-in-stock', name: 'account_back_in_stock', component: page('AccountBackInStock') },
    { path: 'address-book', name: 'account_address_book', component: page('AccountAddressBook') },
    { path: 'address-book/new', name: 'account_address_book_new', component: page('AccountAddressBookNew') },
    { path: 'address-book/:id', name: 'account_address_book_edit', component: page('AccountAddressBookEdit') },
];

const storefrontChildRoutes = [
    { path: '', name: 'index', component: page('Index') },
    { path: 'login', name: 'login', component: page('Login') },
    { path: 'register', name: 'register', component: page('Register') },
    {
        path: 'account',
        name: 'account',
        redirect: { name: 'account_order_list' },
        component: page('Account'),
        meta: { requiresAuth: true },
        // Built-ins first, plugin routes last — vue-router keeps insertion order
        // among equally scored records, so an addon cannot hijack a reserved path.
        children: [...accountChildren, ...pluginAccountRoutes],
    },
    { path: 'wishlist/shared/:token', name: 'wishlist_shared', component: page('WishlistShared') },
    { path: 'category/:slug', name: 'category', component: page('Category') },
    { path: 'manufacturer/:slug', name: 'manufacturer', component: page('Manufacturer') },
    { path: 'search/result', name: 'search', component: page('SearchResult') },
    { path: 'product/:slug', name: 'product', component: page('Product') },
    { path: 'product-review-write/:slug', name: 'product_review_write', component: page('ProductReviewWrite') },
    { path: 'logout', name: 'logout', component: page('Logout') },
    { path: 'cart', name: 'cart', component: page('Cart') },
    { path: 'checkout', name: 'checkout', component: page('Checkout'), meta: { requiresAuth: true } },
    { path: 'checkout-success/:ref', name: 'checkout_success', component: page('CheckoutSuccess') },
    { path: 'contact-us', name: 'contact_us', component: page('ContactUs') },
    {
        path: 'track-order',
        name: 'track_order',
        redirect: '/track-order/form',
        component: page('TrackOrder'),
        children: [
            { path: 'form', name: 'track_order_form', component: page('TrackOrderForm') },
            { path: ':ref', name: 'track_order_details', component: page('TrackOrderDetails') },
        ],
    },
    {
        path: 'return-exchange',
        name: 'return_exchange',
        redirect: '/return-exchange/form',
        component: page('ReturnExchange'),
        children: [
            { path: 'form', name: 'return_exchange_form', component: page('ReturnExchangeForm') },
            { path: ':ref', name: 'return_exchange_process', component: page('ReturnExchangeProcess') },
        ],
    },
    { path: 'article/:slug', name: 'article_details', component: page('ArticleDetails') },
    {
        path: 'blog',
        name: 'blog',
        component: page('Blog'),
        redirect: { name: 'blog_listing' },
        children: [
            { path: 'listing', name: 'blog_listing', component: page('BlogListing') },
            { path: 'search', name: 'blog_search', component: page('BlogSearch') },
            { path: 'category/:slug', name: 'blog_category', component: page('BlogCategory') },
            { path: 'author/:slug', name: 'blog_author', component: page('BlogAuthor') },
        ],
    },
    { path: 'forgot-password', name: 'forgot_password', component: page('PasswordForgotten') },
    { path: 'reset-password/:token', name: 'reset_password', component: page('PasswordReset') },
    { path: 'invoice/:ref', name: 'invoice', component: page('Invoice') },
    { path: 'pay/:token', name: 'pay', component: page('PaymentRequest') },
    { path: 'unsubscribe', name: 'unsubscribe', component: page('Unsubscribe') },
    { path: 'page-not-found', name: 'page_not_found', component: page('PageNotFound') },
    { path: 'addon', name: 'addon', component: page('Addon'), children: [...addonRoutes] },
    { path: ':pathMatch(.*)*', redirect: '/page-not-found' },
];

export const storefrontRoutes = [
    { path: '/', component: Storefront, children: storefrontChildRoutes },
];

const router = createRouter({
    history: createWebHistory(),
    routes: storefrontRoutes,
    scrollBehavior: (to, from, saved) => saved || { top: 0 },
});

/**
 * Send signed-out visitors to the login form, carrying where they were headed
 * so Login.vue's own `?redirect=` handling can be exercised.
 *
 * Reads localStorage rather than the auth store on purpose: a navigation guard
 * can run before the app has mounted, and this needs no active Pinia instance to
 * answer. The key is the one the platform uses.
 */
router.beforeEach((to) => {
    if (!to.matched.some((record) => record.meta?.requiresAuth)) return true;
    if (localStorage.getItem('jwt_customer')) return true;

    return { name: 'login', query: { redirect: to.fullPath } };
});

export default router;
