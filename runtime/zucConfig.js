/**
 * `zucConfig` — the store config the platform inlines into the page shell and
 * exposes as a bare global. Theme files read it directly (`zucConfig.store_name`),
 * never through an import, so the kit has to install it on `window` before any
 * theme module is evaluated.
 *
 * Every key here is one the default theme actually reads, plus the five the app
 * shell itself needs (default_language, default_currency, supported_languages,
 * number_of_items_per_block, ga_measurement_id). Values are plain constants —
 * this is a config object, not behaviour.
 *
 * Override any of it from a `theme-kit.config.json` next to your theme.
 */
export const defaultZucConfig = {
    // Shell
    default_language: 'en',
    default_currency: 'USD',
    supported_languages: '["en"]',
    number_of_items_per_block: 4,
    ga_measurement_id: '',
    recaptcha_site_key: '',

    // Store identity
    store_name: 'Theme Kit Demo Store',
    store_url: 'http://localhost:5180',
    store_email: 'hello@example.com',
    store_phone: '+1 555 0100',
    store_address: '1 Example Street',
    store_city: 'Springfield',
    store_postcode: '12345',
    store_zone: 'CA',
    store_country: 'US',

    // Branding
    fileuploader_store_logo: '',
    store_logo_width: 160,
    store_logo_height: 40,

    // Social
    store_facebook_url: '',
    store_instagram_url: '',
    store_twitter_url: '',
    store_youtube_url: '',

    // Catalog presentation
    // 'n' = prices exclude tax, so tax appears as its own line. AccountOrderDetails
    // tests this against the STRING 'n', not a number - a numeric 0 silently hides
    // the row and nothing warns you.
    product_price_with_tax: 'n',

    // 🚨 These are not arbitrary. A theme builds image URLs as
    // /storage/<size>/<file>, and only the sizes a store has actually generated
    // exist on disk — every other value 404s and the whole catalogue renders as
    // broken-image icons. Probed against the fixture store: 60, 280 and 600 are
    // the three that resolve, matching their three roles (swatch, card, detail).
    // Change these only alongside a store that generates the sizes you set.
    small_image_size: 60,
    medium_image_size: 280,
    large_image_size: 600,
};

/** Installs the global before any theme module runs. */
export function installZucConfig(overrides = {}) {
    window.zucConfig = { ...defaultZucConfig, ...overrides };
    return window.zucConfig;
}
