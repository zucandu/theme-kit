/**
 * `zucConfig` — the store config the platform inlines into the page shell and
 * exposes as a bare global. Theme files read it directly (`zucConfig.store_name`),
 * never through an import, so the kit has to install it on `window` before any
 * theme module is evaluated.
 *
 * 🚨 This is not a hand-picked set. It is EVERY key a real store inlines, because
 * that is exactly what the platform does: `routes/web.php` hands the view
 * `Cache::get('config')` — every `configurations` row with `hidden = 0` — plus
 * six values it adds by hand (`zucandu_subdomain`, `zucandu_plan`,
 * `storefront_origin_url`, `trusted_script_hosts`, `trusted_script_policy`,
 * `trusted_script_enforce`). Captured from a live store: 93 keys.
 *
 * Picking a subset was how `number_of_query_limit` came to be missing, and a
 * theme doing `+zucConfig.number_of_query_limit` got NaN — which Vue reports as
 * "v-for range expects a positive integer value but got NaN" and renders nothing.
 *
 * 🚨 Values are STRINGS, because `configurations.value` is a string column and
 * nothing casts it on the way out. `small_image_size` is "60", not 60. A theme
 * that does `+zucConfig.small_image_size` is fine either way, which is why
 * numbers here went unnoticed — but one that compares or concatenates is not,
 * and it would only fail after upload. The exceptions are the three the platform
 * builds itself: `trusted_script_hosts` (array) and `trusted_script_enforce`
 * (cast to a real boolean, on purpose — a `.env` "false" is truthy in JS).
 *
 * 🚨 `store_email` is NOT here, and adding it back would be a mistake. Its row is
 * seeded `hidden => 1` (ConfigurationsTableSeeder), so it never reaches
 * `Cache::get('config')` and never reaches a theme. A theme reading
 * `zucConfig.store_email` gets `undefined` on every live store — including the
 * default theme, which reads it today. Supplying it here would hide that.
 *
 * Override any of it from a `theme-kit.config.json` next to your theme.
 */
export const defaultZucConfig = {
    admin_language: "en",
    advanced_category_filter_options: "0",
    advanced_category_filter_sections: "0",
    advanced_category_promoted_filters: "0",
    advanced_filter_only_attributes: "0",
    backend_theme: "default",
    backup_max_count: "7",
    date_format: "F d, Y",
    default_currency: "USD",
    default_language: "en",
    dimension_unit: "cm",
    disable_zoom_on_mobile: "1",
    discount_percent_off: "y",
    email_theme: "default",
    fileuploader_store_logo: "",
    frontend_theme: "default",
    items_per_page: "10",
    large_image_size: "600",
    list_of_couriers: "USPS,FedEx,UPS",
    medium_image_size: "280",
    module_discount_coupon_active: "1",
    module_payment_moneyorder_active: "1",
    module_payment_moneyorder_order_status: "1",
    // 🚨 PayPal, Square and Stripe are switched OFF here even though the captured
    // store had them on. Their credentials are nulled below — shipping another
    // store's client IDs would be wrong, and the kit fetches no vendor SDK anyway
    // — so leaving them "1" would advertise three gateways that cannot initialise
    // and would contradict checkout.json, which offers MoneyOrder alone.
    module_payment_paypal_accept_cards: "1",
    module_payment_paypal_accept_credits: "0",
    module_payment_paypal_active: "0",
    module_payment_paypal_environment: "sandbox",
    module_payment_paypal_hosted: "1",
    module_payment_paypal_live_client_id: null,
    module_payment_paypal_order_status: "2",
    module_payment_paypal_paylater: "0",
    module_payment_paypal_sandbox_client_id: null,
    module_payment_paypal_venmo: "0",
    module_payment_square_3d_secure: "0",
    module_payment_square_active: "0",
    module_payment_square_environment: "sandbox",
    module_payment_square_location_id: null,
    module_payment_square_order_status: "2",
    module_payment_square_production_application_id: null,
    module_payment_square_sanbox_application_id: null,
    module_payment_square_sanbox_location_id: null,
    module_payment_stripe_active: "0",
    module_payment_stripe_environment: "sandbox",
    module_payment_stripe_live_publishable_key: null,
    module_payment_stripe_order_status: "2",
    module_payment_stripe_testing_publishable_key: null,
    module_shipping_flat_active: "1",
    module_shipping_flat_handling_fee: "0",
    module_shipping_flat_shipping_cost: "1.25",
    module_shipping_flat_shipping_zone: "0",
    module_shipping_flat_sort_order: "0",
    number_of_items_per_block: "8",
    number_of_processing_data: "100",
    number_of_query_limit: "20",
    product_navigation_order: "id",
    product_price_with_tax: "n",
    quick_reorder_orders_available_from: "",
    return_abandoned_evidence_hours: "24",
    return_access_minutes: "60",
    return_refund_outbound_shipping: "0",
    return_window_days: "",
    shipping_cost_with_tax: "y",
    shipping_max_weight: "50",
    small_image_size: "60",
    store_address: "1 Example Street",
    store_city: "Springfield",
    store_country: "United States",
    store_country_code: "US",
    store_facebook_url: "",
    store_google_analytics_id: "",
    store_instagram_url: "",
    store_logo_height: "40",
    store_logo_width: "200",
    store_name: "Theme Kit Demo Store",
    store_owner: "Theme Kit",
    store_phone: "+1 555 0100",
    store_postcode: "12345",
    store_timezone: "America/New_York",
    store_twitter_url: "",
    store_url: "http://localhost:5180",
    store_version: "1.216.40",
    store_youtube_url: "",
    store_zone: "California",
    store_zone_code: "CA",
    storefront_origin_url: "http://localhost:5180",
    supported_languages: "[\"en\"]",
    time_format: "g:i A",
    trusted_script_enforce: true,
    trusted_script_hosts: ["js.stripe.com","sandbox.web.squarecdn.com","web.squarecdn.com"],
    trusted_script_policy: "zuc-script-url",
    weight_unit: "lb",
    zucandu_plan: "growth",
    zucandu_subdomain: "localhost",

    // Present on a store that has configured reCAPTCHA, absent otherwise — the
    // theme guards on it (`if (zucConfig.recaptcha_site_key)`), so an empty
    // string exercises the same branch an unconfigured store does.
    recaptcha_site_key: '',
};

/** Installs the global before any theme module runs. */
export function installZucConfig(overrides = {}) {
    window.zucConfig = { ...defaultZucConfig, ...overrides };
    return window.zucConfig;
}
