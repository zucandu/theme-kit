/**
 * i18n for the kit.
 *
 * The platform's locale files key translations by the ENGLISH PHRASE itself —
 * `$t('Add to cart')`, not `$t('product.add_to_cart')`. vue-i18n falls back to
 * the key when a message is missing, so an empty message set renders correct
 * English throughout. That is why this kit ships no locale file from the
 * platform: it does not need one, and shipping one would be shipping platform
 * resources for no gain.
 *
 * Warnings are silenced for the same reason — every storefront string is a
 * deliberate "miss", and 500 console warnings would bury the developer's own.
 *
 * Drop `<theme>/locales/<code>.json` next to your theme to preview a real
 * translation; `zuc-theme` passes it through as `messages`.
 */
import { createI18n } from 'vue-i18n';

export function createKitI18n({ locale = 'en', messages = {} } = {}) {
    return createI18n({
        legacy: false,
        globalInjection: true,
        locale,
        fallbackLocale: 'en',
        missingWarn: false,
        fallbackWarn: false,
        silentTranslationWarn: true,
        messages: { en: {}, ...messages },
    });
}
