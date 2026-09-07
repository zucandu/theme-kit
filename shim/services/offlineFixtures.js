/**
 * Fixture answers for the endpoints a theme calls DIRECTLY.
 *
 * Most platform data reaches a theme through a Pinia store, and the shim
 * replaces those stores wholesale. But a few pages skip the stores and reach for
 * `storefrontApi` themselves, and those had no way to get anything: the offline
 * responder resolves `{}` for every URL, so the page read `response.data.items`,
 * got undefined, and rendered its empty state — permanently.
 *
 * 🚨 Two whole pages were unreachable that way, not degraded but unreachable:
 * /account/back-in-stock always said "No back in stock alerts", and
 * /wishlist/shared/:token always said the wishlist was empty. Neither could be
 * laid out at all, and neither was doing anything wrong.
 *
 * A store's own answer is what these mirror; the shapes come from
 * RestockNotifyController::accountIndex and WishlistService::sharedPayload.
 *
 * GET only. A write is a decision a store makes, and answering one here would be
 * inventing an outcome — the responder still resolves those empty, which is the
 * "nothing was saved" a kit should show.
 */
import spotlight from '../../fixtures/product-spotlight.json';
import customer from '../../fixtures/customer.json';

const CATALOGUE = spotlight.new ?? [];

const nameOf = (product) => product.translations?.find((t) => t?.name)?.name ?? '';
const slugOf = (product) => product.translations?.find((t) => t?.slug)?.slug ?? '';

// The API always sends at least one entry, using the placeholder name when a
// product has no image — a theme branches on that string rather than on [].
const imagesOf = (product) => (product.images?.length
    ? product.images.map(({ src }) => ({ src }))
    : [{ src: 'no-image.png' }]);

/**
 * Rows of `restock_notify` joined to their product.
 *
 * Deliberately built from OUT-OF-STOCK products where the catalogue has them:
 * this list exists because the shopper is waiting, and a row whose stock is
 * healthy is the one state the page is not about. `estimated_restock_date`
 * duplicates `availability_date` because the controller sends both.
 */
const restockRows = CATALOGUE
    .filter((product) => +product.quantity <= 0)
    .concat(CATALOGUE)
    .slice(0, 2)
    .map((product, index) => ({
        id: index + 1,
        product_id: product.id,
        sku: product.sku,
        price: product.price,
        sale_price: product.sale_price,
        quantity: product.quantity,
        status: product.status,
        type: product.type,
        name: nameOf(product),
        slug: slugOf(product),
        translations: product.translations ?? [],
        images: imagesOf(product),
        availability_date: 'September 20, 2026',
        estimated_restock_date: 'September 20, 2026',
        subscribed_at: 'September 01, 2026',
    }));

/** The projection WishlistService shares publicly — same rows, no account data. */
const sharedWishlistRows = CATALOGUE.slice(0, 3).map((product, index) => ({
    id: index + 1,
    product_id: product.id,
    sku: product.sku,
    price: product.price,
    sale_price: product.sale_price,
    quantity: product.quantity,
    status: product.status,
    type: product.type,
    translations: product.translations ?? [],
    images: imagesOf(product),
    manufacturer: product.manufacturer ?? null,
    meta: product.meta,
    rating: product.rating,
    total_reviews: product.total_reviews,
    quantity_discount_status: product.quantity_discount_status,
    quantity_discounts: product.quantity_discounts ?? [],
    availability_date: product.availability_date,
    added_at: '2026-09-01 10:24:00',
}));

/**
 * Matched in order, first hit wins. Paths only — a query string is stripped
 * before matching, because `?locale=en` is a parameter, not a different endpoint.
 */
const ROUTES = [
    [/\/api\/v3\/storefront\/account\/restock-notifications\/?$/, () => ({ items: restockRows })],
    [/\/api\/v3\/storefront\/wishlist\/shared\/[^/]+$/, () => ({
        // Only the first name is public, which is the whole point of the field.
        owner_name: customer.customer.firstname,
        items: sharedWishlistRows,
    })],
];

/** The fixture answer for a GET, or null when the kit has none. */
export function fixtureFor(url) {
    const path = String(url || '').split('?')[0];
    const match = ROUTES.find(([pattern]) => pattern.test(path));

    return match ? match[1]() : null;
}
